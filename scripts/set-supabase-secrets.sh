#!/usr/bin/env bash
# GlidePay — push Supabase secrets for sandbox or live Stripe keys.
#
# Usage:
#   export STRIPE_SECRET_KEY=sk_test_...   # or rk_test_...
#   export STRIPE_WEBHOOK_SECRET=whsec_...
#   export STRIPE_PRICE_BASE_ID=price_...
#   export STRIPE_PRICE_SEAT_ID=price_...
#   bash scripts/set-supabase-secrets.sh sandbox
#   bash scripts/set-supabase-secrets.sh live
#
# Requires: supabase CLI logged in + linked to project ojvnxnlrghatkwjrlnop

set -euo pipefail

MODE="${1:-sandbox}"

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "ERROR: Set STRIPE_SECRET_KEY" >&2
  exit 1
fi
if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  echo "ERROR: Set STRIPE_WEBHOOK_SECRET" >&2
  exit 1
fi
if [[ -z "${STRIPE_PRICE_BASE_ID:-}" || -z "${STRIPE_PRICE_SEAT_ID:-}" ]]; then
  echo "ERROR: Set STRIPE_PRICE_BASE_ID and STRIPE_PRICE_SEAT_ID" >&2
  exit 1
fi

PLATFORM_URL="${PLATFORM_URL:-https://glidepay.org}"
if [[ "$MODE" == "sandbox" ]]; then
  PLATFORM_URL="${PLATFORM_URL_SANDBOX:-http://localhost:5500}"
fi

npx supabase secrets set \
  "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}" \
  "STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}" \
  "STRIPE_PRICE_BASE_ID=${STRIPE_PRICE_BASE_ID}" \
  "STRIPE_PRICE_SEAT_ID=${STRIPE_PRICE_SEAT_ID}" \
  "PLATFORM_URL=${PLATFORM_URL}" \
  "CORS_ALLOWED_ORIGIN=${PLATFORM_URL}" \
  "PLATFORM_FROM_EMAIL=${PLATFORM_FROM_EMAIL:-payroll@glidepay.org}"

echo "Secrets updated for $MODE (PLATFORM_URL=$PLATFORM_URL)."
echo "Deploy functions if not already deployed:"
echo "  npx supabase functions deploy stripe-connect"
echo "  npx supabase functions deploy stripe-ach"
echo "  npx supabase functions deploy stripe-checkout"
echo "  npx supabase functions deploy stripe-portal"
echo "  npx supabase functions deploy stripe-webhook --no-verify-jwt"
echo "  npx supabase functions deploy file-tax"
