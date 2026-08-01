# GlidePay Launch Readiness

Last technical review: 2026-08-01. This document records evidence, not approval
to process live payroll. The application remains intentionally sandbox-locked.

## Automated evidence

- JavaScript syntax, secret-pattern scan, dependency audit, and diff checks pass.
- Twenty security and lifecycle tests pass, plus payroll regression assertions.
- All seven deployed sandbox endpoints pass origin/signature preflight checks.
- All Edge Functions pass pinned Deno type checking.
- Stripe webhook event claims, retries, failures, and completed events are idempotent.
- Payroll, ACH, tax filing, rate-limit, and tenant constraints are enforced and validated.
- Database authorization rollback tests pass for owner, admin, employee-self, and cross-company denial paths.
- Local migration timestamps match the deployed Supabase migration history.
- Supabase security advisor has no unexplained application warning; the service-only webhook ledger intentionally has no client policy.

## Reliability controls

- Payroll submission and approval reject duplicate in-flight browser actions.
- Checkout, Billing Portal, Connect onboarding, bank linking, tax filing,
  employee invitations, and pay advances reject duplicate in-flight actions.
- ACH uses stable operation keys and a unique index for one operation per employee/run.
- Webhook responses do not expose internal processing errors.
- Terminal payroll runs and line items are immutable.
- Reconciliation tolerates only a one-cent component-rounding difference and
  excludes retained canceled ACH attempts from active-payout counts.

## Human-controlled blockers

- Run the complete Stripe/Connect sandbox acceptance procedure in `SANDBOX_TESTING.md`.
- Enable Supabase leaked-password protection.
- Complete independent payroll/tax-provider certification for supported jurisdictions.
- Complete legal, privacy, ACH authorization, retention, and incident-response review.
- Confirm backup retention and perform an isolated restore test.
- Assign monitoring and incident owners.
- Obtain Stripe Treasury live approval and reconcile a controlled live transaction.
- Authenticate GitHub tooling, publish the reviewed branch, and pass hosted CI/CodeQL.
- Complete an interactive keyboard, screen-reader, and responsive-browser acceptance pass.

No sandbox-only key or origin guard should be removed until every production
gate is approved and the live environment has separate Supabase and Stripe projects.
