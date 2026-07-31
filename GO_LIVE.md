# GlidePay — Sandbox → Live Cutover

Domain **glidepay.org** is live on GitHub Pages. This checklist wires the fresh Stripe account and Supabase edge functions.

---

## Status snapshot

| Item | Status |
|---|---|
| Domain `glidepay.org` + HTTPS | Done (GitHub Pages) |
| GlidePay rebrand (UI, emails, logos) | In this PR |
| Sandbox products + prices ($29 + $4/seat) | Created on claimable sandbox `acct_1Tz4WmPUXh44gm6Z` |
| Sandbox publishable key + price IDs in `config.js` | Done |
| Sandbox webhook endpoint | Needs full key (claim sandbox or use your account) |
| Supabase secrets / function deploy | Needs Supabase CLI auth |
| Live `pk_live` + live prices | Placeholders — run setup against your fresh account |
| Treasury for platforms (live) | Apply in Dashboard after sandbox validation |

---

## A. Claim the sandbox (do this first)

A claimable Stripe sandbox was provisioned for GlidePay. **Claim it before 2026-08-07** or products/prices disappear:

1. Open: https://dashboard.stripe.com/onboard_sandbox/YWNjdF8xVHo0V21QVVhoNDRnbTZaLDE3ODYxMTM2NDMv100c5jLQrx5  
   Or run: `stripe sandbox claim`
2. After claiming, run `stripe login` and copy the **full** test secret key (`sk_test_…` or an `rk_test_…` RAK).
3. Dashboard → Treasury → Get started (sandbox activation is instant).

Sandbox already has:

| Resource | ID |
|---|---|
| Publishable key | `pk_test_51Tz4Wm…` (in `config.js`) |
| Base price $29/mo | `price_1TzHeRPUXh44gm6ZKVoY1k8O` |
| Seat price $4/mo | `price_1TzHeRPUXh44gm6ZQPtrDRjk` |

Restricted claimable keys cannot create webhooks — use the post-claim secret key for that.

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

Or after claiming:

```bash
export STRIPE_API_KEY=sk_test_…   # post-claim key
bash scripts/setup-stripe.sh sandbox   # only if you need a fresh webhook; prices already exist
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
- Secret values for the claimable sandbox are kept only in `.local/` (gitignored).

---

## Quick commands

| Task | Command |
|---|---|
| Provision products/webhook | `bash scripts/setup-stripe.sh sandbox\|live` |
| Push Supabase secrets | `bash scripts/set-supabase-secrets.sh sandbox\|live` |
| Force sandbox in browser | `?sandbox=1` or `localStorage.setItem('aeropay_env','sandbox')` |
| Force live locally | `localStorage.setItem('aeropay_env','live')` |
