#!/usr/bin/env bash
# Push TaxBandit sandbox credentials into Supabase Edge Function secrets.
#
# Usage:
#   1. Copy taxbandit.env.example → .local/taxbandit.env
#   2. Paste Client ID, Client Secret, User Token from sandbox.taxbandits.com
#   3. bash scripts/set-taxbandit-secrets.sh
#   4. npx supabase functions deploy file-tax --project-ref ojvnxnlrghatkwjrlnop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.local/taxbandit.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy taxbandit.env.example → .local/taxbandit.env and fill credentials."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${TAXBANDIT_CLIENT_ID:?TAXBANDIT_CLIENT_ID required}"
: "${TAXBANDIT_CLIENT_SECRET:?TAXBANDIT_CLIENT_SECRET required}"
: "${TAXBANDIT_USER_TOKEN:?TAXBANDIT_USER_TOKEN required}"

if [[ -f "$ROOT/.local/supabase.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT/.local/supabase.env"; set +a
fi

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN or source .local/supabase.env}"
: "${SUPABASE_PROJECT_REF:=ojvnxnlrghatkwjrlnop}"

export SUPABASE_ACCESS_TOKEN

ARGS=(
  "TAXBANDIT_CLIENT_ID=$TAXBANDIT_CLIENT_ID"
  "TAXBANDIT_CLIENT_SECRET=$TAXBANDIT_CLIENT_SECRET"
  "TAXBANDIT_USER_TOKEN=$TAXBANDIT_USER_TOKEN"
  "EFILE_PROVIDER=${EFILE_PROVIDER:-TaxBandit}"
)

[[ -n "${TAXBANDIT_AUTH_URL:-}" ]] && ARGS+=("TAXBANDIT_AUTH_URL=$TAXBANDIT_AUTH_URL")
[[ -n "${TAXBANDIT_API_BASE:-}" ]] && ARGS+=("TAXBANDIT_API_BASE=$TAXBANDIT_API_BASE")

echo "Setting TaxBandit secrets on project $SUPABASE_PROJECT_REF…"
npx --yes supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" "${ARGS[@]}"
echo "Done. Redeploy: npx supabase functions deploy file-tax --project-ref $SUPABASE_PROJECT_REF"
