# GlidePay — Sandbox Testing Guide
### Full end-to-end test of the Treasury ACH payroll disbursement flow

See also [GO_LIVE.md](./GO_LIVE.md) for claim/cutover steps.

---

## Prerequisites

Before testing locally you need:

1. A Stripe account with Treasury for platforms **activated in sandbox** (instant, no approval needed — Dashboard → Treasury → Get started)
2. Your Stripe **test-mode keys** (`pk_test_…`, `sk_test_…`)
3. Your Supabase project credentials

A claimable sandbox was already provisioned with GlidePay products/prices and `config.js` SANDBOX keys filled in. **Claim it** (see GO_LIVE.md) before creating the webhook — claimable RAKs cannot register webhook endpoints.

---

## Step 1 — Configure sandbox keys

### Frontend (`config.js`)

Sandbox publishable key is set for **GlidePay Test**. Fill in price IDs from that Dashboard (test mode):

- Base $29/mo → `SANDBOX.priceBaseId`
- Seat $4/mo with metadata `type=per_seat` → `SANDBOX.priceSeatId`

When you open the app on `localhost`, `config.js` automatically uses `SANDBOX`. Force sandbox on the live domain with `?sandbox=1`.

### Edge function secrets (Supabase)

Swap to test-mode keys so edge functions hit the Stripe sandbox:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_TEST_WEBHOOK_SECRET
supabase secrets set PLATFORM_URL=http://localhost:5500   # or your dev URL
# Optional — for alert emails:
supabase secrets set RESEND_API_KEY=re_YOUR_KEY
supabase secrets set PLATFORM_FROM_EMAIL=onboarding@resend.dev
```

> To restore live keys after testing: `supabase secrets set STRIPE_SECRET_KEY=sk_live_…`

Or use `bash scripts/set-supabase-secrets.sh sandbox` after exporting the two Stripe vars.

### Create test-mode prices (only if starting fresh)

```bash
export STRIPE_API_KEY=sk_test_…
bash scripts/setup-stripe.sh sandbox
```

Dashboard path: Products (test mode) → Base $29/mo + Seat $4/mo with metadata `type = per_seat`.

---

## Step 2 — Run the database migrations

```bash
supabase db push
```

This applies migrations including:
- `20260624000000` — `ach_transfers` table, employee bank account columns
- `20260624000001` — `stripe_account_id`, `stripe_account_status`, `stripe_financial_account_id` on companies
- `20260624000002` — `bank_account_linked_at` on employees (3-day hold)
- `20260702000000` — `tax_filing_submissions` for e-file

---

## Step 3 — Deploy edge functions

```bash
supabase functions deploy stripe-connect
supabase functions deploy stripe-ach
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy file-tax
```

---

## Step 4 — Register the test webhook endpoint

In Stripe Dashboard (test mode) → Developers → Webhooks → Add endpoint:

```
https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-webhook
```

Events to enable:
```
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
account.updated
treasury.outbound_transfer.posted
treasury.outbound_transfer.failed
treasury.outbound_transfer.returned
```

Also enable **"Send events from connected accounts"** on that endpoint — required for `account.updated` and Treasury events.

Copy the signing secret → `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…`

---

## Step 5 — Full payroll test run

### 5a. Sign up and complete company onboarding

1. Open `http://localhost:5500` (or `open index.html`)
2. Sign up with a test email
3. Setup wizard → enter company name + EIN (any 9-digit number is fine in test)
4. Skip the bank step for now — Treasury replaces it

### 5b. Start Stripe Connect onboarding

1. Settings → "ACH Direct Deposit — Stripe Connect" card → **Start Stripe Onboarding**
2. You'll be redirected to Stripe's hosted onboarding (test mode — no real documents needed)
3. Use Stripe's test data:
   - Business: any name
   - EIN: `000000000`
   - Address: any US address
   - Owner DOB: `01/01/1901` (Stripe test bypass)
   - Owner SSN last 4: `0000`
4. Submit → you'll be redirected back to GlidePay with `?connect=return`
5. The `account.updated` webhook will fire; within ~30 seconds the status card should show **Active** and a Financial Account ID will appear

> If the webhook doesn't fire within 1 minute, trigger it manually:
> ```bash
> stripe trigger account.updated --stripe-account=acct_YOUR_CONNECTED_ACCOUNT_ID
> ```

### 5c. Add a test employee

Employees → Add Employee → fill in name, email, any rate.

### 5d. Link the employee's bank account

1. Click the employee → Direct Deposit tab → **Link Bank Account for ACH Deposit**
2. Stripe Financial Connections opens in test mode — use the test institution **"Stripe Test Bank"**
3. Select a test account (routing: `110000000`, any account number)
4. After confirmation the card shows **••••6789 — Linked**
5. Check the audit log — you should see "Bank Account Linked — 3-day hold applied"
6. If `RESEND_API_KEY` is set, check the employee's inbox for the alert email

### 5e. Verify the 3-day hold fires

1. Payroll → Run Payroll → complete the run for that employee → Submit
2. The toast should say: **"1 employee on a 3-day security hold — transfers will release automatically"**
3. Check `ach_transfers` in Supabase Table Editor — status should be `held`

To test the transfer path immediately (bypass the hold), run this SQL in the Supabase SQL editor:

```sql
UPDATE employees
SET bank_account_linked_at = now() - interval '4 days'
WHERE email = 'employee@test.com';
```

Then run payroll again. This time the hold won't apply.

### 5f. Verify the OutboundTransfer

After bypassing the hold and rerunning payroll:

1. `ach_transfers` row should have `status = processing` and a `stripe_transfer_id` starting with `obt_`
2. Open Stripe Dashboard (test mode) → Treasury → Financial Accounts → select the connected account's FA → Transactions
3. You should see the OutboundTransfer

### 5g. Simulate the webhook confirmation

In Stripe Dashboard → Webhooks → click your endpoint → Send test event:
- Select `treasury.outbound_transfer.posted`
- Or use the CLI: `stripe trigger treasury.outbound_transfer.posted`

The `ach_transfers` row should flip to `status = succeeded` and an audit log entry "ACH Transfer Sent" should appear.

---

## Stripe test bank account numbers

| Routing | Account | Behaviour |
|---|---|---|
| `110000000` | any | Successful ACH transfer |
| `110000000` | `000111111116` | Transfer fails (R16 — account frozen) |
| `110000000` | `000111111113` | Transfer returned (R03 — no account) |

Use the failure accounts to test webhook handling of `treasury.outbound_transfer.failed` and `.returned`.

---

## Checklist

- [ ] Claim sandbox / have full `sk_test_…` key
- [ ] `config.js` SANDBOX keys filled in
- [ ] Supabase secrets updated to `sk_test_…`
- [ ] DB migrations applied (`supabase db push`)
- [ ] All edge functions deployed
- [ ] Test webhook endpoint registered with "connected accounts" events enabled
- [ ] Company onboarding completed → status shows **Active**
- [ ] Employee bank account linked → audit log + alert email received
- [ ] Payroll run with new account → status shows `held`
- [ ] Hold bypassed via SQL → status shows `processing` with Stripe transfer ID
- [ ] `treasury.outbound_transfer.posted` webhook → status flips to `succeeded`
- [ ] Failure account tested → `failed` status + `failure_message` populated
