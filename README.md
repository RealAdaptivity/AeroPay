# GlidePay

GlidePay is a browser-based payroll and compliance application backed by Supabase and Stripe. The repository is in pre-release hardening; it must not process live payroll until the launch checklist is complete.

## Local development

Requirements: Node.js 20 or newer, Deno 2.4.2, and a static HTTP server.

```bash
npm install
npm run check
npx serve .
```

Localhost uses sandbox configuration. Public and preview hostnames always use live configuration and never fall back to sandbox.

## Configuration

Browser-safe publishable values live in `config.js`. Secret keys belong only in Supabase Edge Function secrets and must never be committed.

Required production Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASE_ID`
- `STRIPE_PRICE_SEAT_ID`
- `PLATFORM_URL=https://glidepay.org`
- `CORS_ALLOWED_ORIGIN=https://glidepay.org`

Additional provider secrets are documented in `GO_LIVE.md` and `SANDBOX_TESTING.md`.

Use separate Supabase projects and Stripe accounts for development/staging and production. Do not switch one deployed project's secrets between test and live modes.

The bundled payroll engine is a sandbox estimator, not a certified tax engine.
It blocks unsupported state-tax jurisdictions instead of applying a fallback
rate. Independent payroll/tax-provider validation is required before live use.

## Checks

`npm run check` performs JavaScript syntax checks, a committed-secret pattern scan, configuration boundary tests, and payroll-engine verification. Pull requests run the same checks in GitHub Actions.

## Deployment safety

Before a public launch:

1. Complete every item in `GO_LIVE.md`.
2. Apply and verify migrations in staging.
3. Deploy Edge Functions with production secrets.
4. Confirm Stripe webhook signing and retry behavior.
5. Run end-to-end billing, payroll, ACH, and tax-filing tests.
6. Obtain legal, tax, security, and compliance review appropriate to the jurisdictions served.

See `FRAUD_RISK_MANAGEMENT.md` for Treasury controls.
