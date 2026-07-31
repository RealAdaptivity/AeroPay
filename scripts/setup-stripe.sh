#!/usr/bin/env bash
# GlidePay — provision Stripe products, prices, and webhook for sandbox or live.
#
# Usage:
#   export STRIPE_API_KEY=sk_test_...   # or rk_test_... / sk_live_...
#   bash scripts/setup-stripe.sh sandbox
#   bash scripts/setup-stripe.sh live
#
# Prints price IDs to paste into config.js, and the webhook signing secret
# for `supabase secrets set STRIPE_WEBHOOK_SECRET=...`.

set -euo pipefail

MODE="${1:-sandbox}"
WEBHOOK_URL="${WEBHOOK_URL:-https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-webhook}"

if [[ -z "${STRIPE_API_KEY:-}" ]]; then
  echo "ERROR: Set STRIPE_API_KEY to a test or live secret/restricted key." >&2
  exit 1
fi

if [[ "$MODE" != "sandbox" && "$MODE" != "live" ]]; then
  echo "Usage: $0 sandbox|live" >&2
  exit 1
fi

echo "==> Mode: $MODE"
echo "==> Creating GlidePay products + prices..."

BASE_PRODUCT=$(stripe products create \
  --name="GlidePay Base" \
  --description="GlidePay payroll platform — base subscription" \
  -d "metadata[plan]=base" \
  --api-key "$STRIPE_API_KEY" | tee /dev/stderr | grep -o '"id": "prod_[^"]*"' | head -1 | cut -d'"' -f4)

SEAT_PRODUCT=$(stripe products create \
  --name="GlidePay Seat" \
  --description="Per-employee seat for GlidePay payroll" \
  -d "metadata[type]=per_seat" \
  --api-key "$STRIPE_API_KEY" | tee /dev/stderr | grep -o '"id": "prod_[^"]*"' | head -1 | cut -d'"' -f4)

BASE_PRICE=$(stripe prices create \
  --product="$BASE_PRODUCT" \
  --unit-amount=2900 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "nickname=GlidePay Base Monthly" \
  --api-key "$STRIPE_API_KEY" | tee /dev/stderr | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)

SEAT_PRICE=$(stripe prices create \
  --product="$SEAT_PRODUCT" \
  --unit-amount=400 \
  --currency=usd \
  -d "recurring[interval]=month" \
  -d "nickname=GlidePay Seat Monthly" \
  -d "metadata[type]=per_seat" \
  --api-key "$STRIPE_API_KEY" | tee /dev/stderr | grep -o '"id": "price_[^"]*"' | head -1 | cut -d'"' -f4)

echo
echo "==> Creating webhook endpoint (Connect events enabled)..."
set +e
WH_JSON=$(stripe webhook_endpoints create \
  --url="$WEBHOOK_URL" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=account.updated" \
  -d "enabled_events[]=treasury.outbound_transfer.posted" \
  -d "enabled_events[]=treasury.outbound_transfer.failed" \
  -d "enabled_events[]=treasury.outbound_transfer.returned" \
  -d "connect=true" \
  --api-key "$STRIPE_API_KEY" 2>&1)
WH_RC=$?
set -e
echo "$WH_JSON"
WH_SECRET=""
if [[ $WH_RC -eq 0 ]]; then
  WH_SECRET=$(echo "$WH_JSON" | grep -o '"secret": "whsec_[^"]*"' | head -1 | cut -d'"' -f4 || true)
fi

echo
echo "════════════════════════════════════════════════════════════"
echo " GlidePay Stripe setup complete ($MODE)"
echo "════════════════════════════════════════════════════════════"
echo
echo "Paste into config.js ($MODE block):"
echo "  priceBaseId: \"$BASE_PRICE\""
echo "  priceSeatId: \"$SEAT_PRICE\""
echo
echo "Publishable key: Dashboard → Developers → API keys → copy pk_test_ or pk_live_"
echo "  → config.js stripePublishableKey"
echo
echo "Set Supabase edge secrets:"
echo "  supabase secrets set STRIPE_SECRET_KEY=\$STRIPE_API_KEY"
if [[ -n "$WH_SECRET" ]]; then
  echo "  supabase secrets set STRIPE_WEBHOOK_SECRET=$WH_SECRET"
else
  echo "  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…   # Dashboard → Webhooks"
fi
echo "  supabase secrets set PLATFORM_URL=https://glidepay.org"
echo
echo "Products: $BASE_PRODUCT / $SEAT_PRODUCT"
