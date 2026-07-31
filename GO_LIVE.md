# GlidePay — Sandbox → Live Cutover

Domain **glidepay.org** is live on GitHub Pages. This checklist wires the fresh Stripe account and Supabase edge functions.

---

## Status snapshot

| Item | Status |
|---|---|
| Domain `glidepay.org` + HTTPS | Done (GitHub Pages) |
| GlidePay rebrand (UI, emails, logos) | Done |
| Sandbox publishable key (GlidePay Test) | Done |
| Sandbox price IDs ($29 + $4/seat) | Done |
| Sandbox webhook (subscriptions + account.updated) | Done |
| Treasury for platforms (sandbox) | Done — Connect → Stripe Treasury visible |
| Treasury events on webhook | Done |
| Supabase secrets / function deploy | Needs Supabase auth |
| Live `pk_live` + live prices | Placeholders |
| Treasury for platforms (live) | Apply in Dashboard after sandbox validation |

---

## A. GlidePay Test sandbox

Using **GlidePay Test** (`acct_1TkoXCAsgAzfeB6D`).

| Resource | ID |
|---|---|
| Publishable key | in `config.js` |
| Base price $29/mo | `price_1TzIdaAsgAzfeB6DKeordaY7` |
| Seat price $4/mo | `price_1TzIdbAsgAzfeB6D0GyWkgXK` |
| Webhook | `we_1TzIe4AsgAzfeB6D5DUtFuR5` → edge `stripe-webhook` (includes Treasury events) |

Treasury for Platforms is active in this sandbox. Financial accounts are created via API when companies complete Connect onboarding in the app.

---

## B. Finish sandbox wiring

### 1. Webhook (test mode)

Dashboard (test) → Developers → Webhooks → Add endpoint:

```
https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-webhook
```

Events:

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

Enable **Send events from connected accounts**. Copy `whsec_…`.

Or with a secret/restricted key from GlidePay Test:

```bash
export STRIPE_API_KEY=sk_test_…   # or rk_test_…
bash scripts/setup-stripe.sh sandbox   # only if you need a fresh webhook; reuse existing prices if present
```

### 2. Supabase secrets (test keys)

```bash
npx supabase login
npx supabase link --project-ref ojvnxnlrghatkwjrlnop

export STRIPE_SECRET_KEY=sk_test_…
export STRIPE_WEBHOOK_SECRET=whsec_…
bash scripts/set-supabase-secrets.sh sandbox
```

### 3. Migrations + functions

```bash
npx supabase db push
npx supabase functions deploy stripe-connect
npx supabase functions deploy stripe-ach
npx supabase functions deploy stripe-checkout
npx supabase functions deploy stripe-portal
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy file-tax
```

### 4. End-to-end test

Follow [SANDBOX_TESTING.md](./SANDBOX_TESTING.md):

```
http://localhost:5500          # auto-sandbox
https://glidepay.org/?sandbox=1
```

Checklist: Connect onboarding → Active FA → employee bank link → 3-day hold → OutboundTransfer → webhook `posted`.

---

## C. Go live (fresh Stripe account)

### 1. Platform profile

In the **live** Dashboard for the new GlidePay Stripe account:

- [ ] Business details + public details: name **GlidePay**, URL `https://glidepay.org`
- [ ] Brand icon: `assets/logo-200.png`
- [ ] Connect settings / platform profile completed
- [ ] Treasury for platforms applied (use `FRAUD_RISK_MANAGEMENT.md`)
- [ ] Customer email: `support@glidepay.org`

### 2. Live products + webhook

```bash
export STRIPE_API_KEY=sk_live_…   # prefer a restricted key (rk_live_…) with least privilege
bash scripts/setup-stripe.sh live
```

Paste printed `price_…` IDs and `pk_live_…` into `config.js` → `LIVE`.

### 3. Flip Supabase to live secrets

```bash
export STRIPE_SECRET_KEY=sk_live_…   # or rk_live_…
export STRIPE_WEBHOOK_SECRET=whsec_… # from the *live* webhook endpoint
export PLATFORM_URL=https://glidepay.org
bash scripts/set-supabase-secrets.sh live
```

Redeploy functions after secret changes if your project caches them (usually not required).

### 4. Ship frontend

Merge this PR so GitHub Pages serves GlidePay branding + sandbox keys + live placeholders filled.

### 5. Smoke test live

1. Open https://glidepay.org (must be `LIVE`, not sandbox)
2. Sign up → subscribe with a real card (small amount) → cancel via Customer Portal
3. Run Connect onboarding for a real test company (or keep Treasury gated until approved)
4. Confirm live webhook deliveries in Dashboard → Developers → Webhooks

---

## D. Security notes

- **Never commit** `sk_` / `rk_` / `whsec_` keys. Only `pk_` publishable keys belong in `config.js`.
- Prefer [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys) over full secret keys.
- Old AeroPay live keys were removed from `config.js` — rotate them in the old Stripe account if that account still exists.

---

## Quick commands

| Task | Command |
|---|---|
| Provision products/webhook | `bash scripts/setup-stripe.sh sandbox\|live` |
| Push Supabase secrets | `bash scripts/set-supabase-secrets.sh sandbox\|live` |
| Force sandbox in browser | `?sandbox=1` or `localStorage.setItem('aeropay_env','sandbox')` |
| Force live locally | `localStorage.setItem('aeropay_env','live')` |
