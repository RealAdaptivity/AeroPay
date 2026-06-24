# AeroPay — Fraud Risk Management Statement
### Stripe Treasury for Platforms Application

---

## Overview

AeroPay is a B2B payroll SaaS platform serving US-based businesses. We process ACH payroll disbursements on behalf of employer connected accounts to their employees' bank accounts. This document describes the fraud controls we have in place for each risk category Stripe evaluates during Treasury for platforms approval.

---

## 1. Identity Fraud — Fake Companies

**Risk:** A bad actor creates a fraudulent company account on AeroPay to gain access to a Treasury Financial Account and initiate outbound transfers to accounts they control.

**Controls:**

- **Stripe KYB onboarding (primary):** Every company that wants ACH disbursement capabilities must complete Stripe's hosted account onboarding (`type: "custom"`), which collects business name, EIN, address, beneficial owner identity (SSN/DOB), and supporting documents. Stripe is the verifying party — AeroPay does not grant Treasury access until `stripe_account_status = "active"`, which only happens after Stripe's `account.updated` webhook confirms all capabilities are `active` and `requirements.currently_due` is empty.

- **Subscription gate:** AeroPay requires an active paid subscription (Stripe Checkout, verified credit card) before a company can process payroll. This adds a real financial cost to account creation and filters out fully anonymous bad actors.

- **Audit log:** Every action on a company account — including account creation, EIN updates, bank account changes, and payroll runs — is written to an immutable `audit_log` table with actor, timestamp, and details. This provides a forensic trail for any disputed activity.

---

## 2. Account Takeover — Redirecting Employee Payroll

**Risk:** An attacker gains access to an employee or admin account and changes a direct deposit bank account to redirect net pay to a mule account.

**Controls:**

- **3-business-day hold on newly linked bank accounts (code-enforced):** When an employee links or changes their bank account, `bank_account_linked_at` is stamped in the `employees` table. The `stripe-ach` edge function's `disburse` action checks this timestamp before each OutboundTransfer. If fewer than 72 hours have elapsed, the transfer is written to `ach_transfers` with `status = "held"` and no funds move. The hold releases automatically on the next payroll run after the window expires.

- **Dual alert emails on bank account change:** The moment a bank account is confirmed (`confirm_setup` action), AeroPay sends:
  1. An alert to the **employee's registered email** — "Your direct deposit was updated to ••••XXXX. If you did not do this, contact your payroll admin immediately."
  2. An alert to the **company admin email** — "[AeroPay] Bank account changed — Employee Name" with the old and new last-4 digits.
  
  This gives a 3-day window to catch and reverse unauthorized changes before any funds move.

- **Stripe Financial Connections (no raw account numbers):** AeroPay never collects or stores routing and account numbers directly. Bank accounts are linked via Stripe.js `collectBankAccountForSetup`, which uses Stripe Financial Connections. Only the payment method ID and last-4 are stored. This means a database breach does not expose usable account credentials.

- **Audit log:** All bank account changes are written to `audit_log` with the previous and new last-4, actor, and timestamp.

---

## 3. ACH Return Abuse — Disputed Legitimate Debits

**Risk:** An employee or employer disputes a legitimate ACH debit as unauthorized, causing a return and potential chargeback loss.

**Controls:**

- **Affirmative consent at bank linking:** Employees link their own bank account through Stripe Financial Connections, which requires them to authenticate directly with their bank (OAuth) or verify micro-deposits. This creates an auditable authorization record at the Stripe level. AeroPay stores the `stripe_pm_id` and `bank_account_linked_at` timestamp as secondary evidence.

- **Payroll run records:** Every payroll disbursement is backed by a `payroll_runs` row (with gross pay, net pay, period start/end, and per-employee calculation detail in `payroll_run_line_items`) and a corresponding `ach_transfers` row linking the transfer to the run and employee. These records can be produced as evidence in a dispute.

- **OutboundTransfer description:** Every Stripe Treasury OutboundTransfer includes a `description` of `"AeroPay payroll — run {payrollRunId}"` and `metadata` containing `company_id`, `employee_id`, and `payroll_run_id`, making disputes traceable to the specific payroll run.

- **Webhook-driven status tracking:** `treasury.outbound_transfer.posted`, `failed`, and `returned` events update the `ach_transfers` table in real time and write audit log entries. Returns are immediately visible to admins in the AeroPay interface.

---

## 4. Velocity / Anomalous Run Detection

**Risk:** A compromised admin account initiates an unusually large payroll run (e.g., inflated amounts or fictitious employees) to move funds out of the Financial Account.

**Controls:**

- **Per-employee payroll calculations are server-computed:** Net pay is derived by the `calculatePayroll` engine from the employee's stored `rate`, `pay_frequency`, and withholding settings — not from a free-form amount entered at run time. This limits the ability to inflate a single disbursement without also modifying the underlying employee record (which generates its own audit log entry).

- **Audit log on all employee record changes:** Changes to salary/rate, classification, and bank account details each produce an `audit_log` row. A pattern of rate inflation followed immediately by a large payroll run is detectable on review.

- **Subscription seat-count billing:** AeroPay's billing model charges per employee seat. Adding fictitious employees to inflate a payroll run also increases the monthly invoice, creating a financial disincentive and an audit signal.

---

## 5. Platform-Level Controls

- **Row-Level Security (RLS):** All Supabase tables (`employees`, `payroll_runs`, `ach_transfers`, `audit_log`, etc.) have RLS policies that restrict read/write access to the authenticated user's own company. Cross-company data access is structurally prevented at the database level.

- **JWT authentication on all edge functions:** Every edge function (`stripe-ach`, `stripe-connect`, `stripe-checkout`) verifies the caller's Supabase JWT before processing any request. Unauthenticated calls return 401.

- **Connected account isolation:** Each company's Treasury Financial Account belongs to their own Stripe connected account. AeroPay (the platform) cannot initiate OutboundTransfers from a connected account's Financial Account except via API calls made in that account's context — there is no pooled float held by AeroPay.

- **Secrets management:** Stripe secret keys, webhook signing secrets, and Resend API keys are stored as Supabase Edge Function secrets and are never exposed to the browser or committed to source control.

---

## Summary Table

| Risk | Primary Control | Secondary Control |
|---|---|---|
| Identity fraud (fake companies) | Stripe KYB onboarding (required before Treasury activation) | Paid subscription gate |
| Account takeover (bank redirect) | 3-day hold on newly linked accounts | Dual alert emails to employee + admin |
| ACH return abuse | Stripe Financial Connections consent + transfer records | Webhook-driven return tracking |
| Velocity / large run anomalies | Server-computed payroll (no free-form amounts) | Audit log on rate/employee changes |
| Cross-company data access | Supabase RLS on all tables | JWT auth on all edge functions |

---

*This document reflects controls implemented in the AeroPay codebase as of June 2026. Controls are enforced in application code and Supabase database policy — not solely reliant on process.*
