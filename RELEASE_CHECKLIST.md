# Release Checklist

## Automated

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run verify:sandbox`
- [ ] Supabase security advisor has no unexplained warnings
- [ ] Supabase performance advisor reviewed
- [ ] CodeQL and dependency checks pass
- [ ] `git diff --check` passes

## Sandbox acceptance

- [ ] Owner signup and email confirmation
- [ ] Connect onboarding and financial account readiness
- [ ] Employee invitation and self-only portal access
- [ ] Bank linking and three-business-day hold
- [ ] Payroll submit, approve, release, post, fail, and return
- [ ] Retry does not create a duplicate outbound payment
- [ ] Duplicate webhook delivery changes state only once
- [ ] Checkout, subscription sync, seat update, Portal, and cancellation
- [ ] Cross-company and employee/admin authorization tests

## Production gate

- [ ] Independent tax-provider validation complete
- [ ] Supported jurisdictions documented and unsupported states blocked
- [ ] Legal/privacy/ACH authorization review complete
- [ ] Backups and restore test confirmed
- [ ] Monitoring and incident owner assigned
- [ ] Live environment uses separate Supabase and Stripe projects
- [ ] Sandbox-only origin and key guards deliberately replaced and reviewed
- [ ] Live webhook secret and event selection verified
- [ ] Small controlled transaction reconciled
