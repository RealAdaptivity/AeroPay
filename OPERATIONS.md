# GlidePay Operations Runbook

This runbook applies after the sandbox test and before any live payroll. Never
paste employee, bank, tax, JWT, webhook-secret, or Stripe-secret data into an
issue, chat, log ticket, or screenshot.

## Daily checks

1. Review Supabase Edge Function errors and authentication anomalies.
2. Review Stripe webhook deliveries for repeated failures.
3. Reconcile each completed payroll run against `ach_transfers` by
   `payroll_run_id`; there must be one operation key per employee.
4. Investigate transfers remaining `processing` beyond the provider's expected
   window and any `failed` or `returned` transfer.
5. Confirm no webhook event remains `processing` for more than 15 minutes.

Read-only reconciliation query. Canceled attempts are retained for audit but do
not count as duplicate payouts. Header/line comparisons allow a one-cent
rounding difference:

```sql
with line_totals as (
  select payroll_run_id,
         round(coalesce(sum(gross_pay),0),2) gross_pay,
         round(coalesce(sum(total_employer_taxes),0),2) employer_taxes,
         round(coalesce(sum(total_payroll_cost),0),2) total_cost,
         count(*)::int employee_count
  from payroll_line_items group by payroll_run_id
), active_transfers as (
  select * from ach_transfers
  where status in ('pending','held','processing','succeeded','failed')
)
select pr.id, pr.run_date, pr.status,
       abs(round(pr.gross_payroll,2)-lt.gross_pay) <= 0.01 as gross_matches,
       abs(round(pr.employer_taxes,2)-lt.employer_taxes) <= 0.01 as taxes_match,
       abs(round(pr.total_cost,2)-lt.total_cost) <= 0.01 as cost_matches,
       pr.employee_count=lt.employee_count as employee_count_matches,
       count(at.id) as active_transfer_rows,
       count(distinct at.employee_id) as employees_with_transfers,
       sum(at.amount_cents) filter (where at.status in ('processing','succeeded')) as sent_cents,
       array_agg(distinct at.status) filter (where at.status is not null) as transfer_statuses
from payroll_runs pr
left join line_totals lt on lt.payroll_run_id=pr.id
left join active_transfers at on at.payroll_run_id=pr.id
where pr.status='completed'
group by pr.id,pr.run_date,pr.status,lt.gross_pay,lt.employer_taxes,lt.total_cost,lt.employee_count
order by pr.run_date desc;
```

## Payroll incident response

1. Stop approving new payroll runs. Do not delete or edit ledger rows.
2. Record the payroll run ID, Stripe request/event IDs, time, and observed
   status—never full account details.
3. Determine whether Stripe accepted an outbound payment before retrying.
4. Retry only through the normal application path. Stable operation keys make
   that path idempotent; do not create a manual replacement with a new key.
5. For a return or failure, preserve the original row and status. Correct the
   underlying bank/funding issue, then use an explicitly reviewed recovery
   procedure.
6. Notify affected administrators and employees using an approved template.
7. Write a post-incident report and add a regression test.

## Webhook outage

1. Confirm the endpoint rejects an unsigned request.
2. Review Stripe delivery attempts and Supabase Edge logs.
3. Restore the endpoint or secret; do not disable signature verification.
4. Ask Stripe to retry failed deliveries. The webhook ledger safely ignores
   already processed event IDs.
5. Reconcile Stripe objects against Supabase after replay completes.

## Backup and recovery

- Confirm the Supabase plan's point-in-time recovery and backup retention before
  launch. Record the owner and quarterly restore-test date.
- Export configuration and migration history, not production secrets.
- Test restoration into an isolated project. Never overwrite the live project
  as the first recovery attempt.
- After restoration, rotate secrets, verify RLS/advisors, redeploy functions,
  and reconcile Stripe before reopening payroll approval.

## Access and secrets

- Require MFA for GitHub, Supabase, Stripe, email, and domain administrators.
- Use separate named administrator accounts; do not share credentials.
- Grant the minimum roles needed and review access quarterly.
- Rotate immediately after suspected disclosure or staff departure.
- Keep test and live Stripe/Supabase environments separate.

## Launch gate

Live payroll remains blocked until all of these are recorded:

- Complete sandbox flow, including failure, return, retry, and duplicate-event tests.
- Supabase leaked-password protection enabled.
- Independent tax/payroll validation for every supported jurisdiction.
- Stripe Treasury live approval and verified funding/reconciliation process.
- Legal, privacy, ACH authorization, record-retention, and incident-response review.
- Monitoring recipient and on-call owner assigned.
- Restore test completed.
- Small controlled live transaction approved by two people.
