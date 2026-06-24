-- Stripe Custom connected account fields on companies
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS stripe_account_id       text DEFAULT '',
    ADD COLUMN IF NOT EXISTS stripe_account_status   text DEFAULT 'not_created',
    -- not_created | pending_onboarding | pending_verification | active
    ADD COLUMN IF NOT EXISTS stripe_financial_account_id text DEFAULT '';

-- Index so webhooks can resolve companies quickly by connected-account ID
CREATE INDEX IF NOT EXISTS idx_companies_stripe_account ON companies(stripe_account_id);
