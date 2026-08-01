# Security Policy

GlidePay processes payroll and employee information. Please do not disclose a
suspected vulnerability in a public issue or include real employee, banking,
tax, authentication, or Stripe data in a report.

## Supported version

Only the latest revision of the `main` branch is supported. The current build
is a sandbox validation build and must not be used for live payroll.

## Reporting

Use GitHub's private vulnerability reporting feature for this repository. A
useful report includes the affected component, reproduction steps using test
data, impact, and any suggested mitigation. Do not test against accounts or
companies you do not own.

## Security model

- Stripe mutations occur in authenticated Supabase Edge Functions; webhook
  requests are signature-verified.
- Payroll payouts are calculated from approved database line items and use
  stable idempotency keys.
- Company-wide data is restricted to owner/admin/accountant memberships for
  that exact company. Employees have self-only access where applicable.
- The current deployment accepts only Stripe test keys and the localhost test
  origin.
- Secrets must remain in Supabase or GitHub secret storage and must never be
  committed to the browser application.

Before a production launch, enable leaked-password protection in Supabase,
complete the documented sandbox test, rotate production secrets, and follow
`GO_LIVE.md`.
