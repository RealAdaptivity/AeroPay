-- ACH: store employee bank account details and Stripe payment method reference
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS bank_routing       text    DEFAULT '',
    ADD COLUMN IF NOT EXISTS bank_account_last4 text    DEFAULT '',
    ADD COLUMN IF NOT EXISTS stripe_pm_id       text    DEFAULT '';

-- Track individual ACH transfer records per payroll run
CREATE TABLE IF NOT EXISTS ach_transfers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    payroll_run_id      uuid REFERENCES payroll_runs(id) ON DELETE SET NULL,
    employee_id         uuid REFERENCES employees(id) ON DELETE SET NULL,
    stripe_transfer_id  text,
    amount_cents        integer NOT NULL,
    status              text NOT NULL DEFAULT 'pending',  -- pending | processing | succeeded | failed | canceled
    failure_message     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ach_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_own_ach" ON ach_transfers
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- Index for webhook lookups by Stripe transfer ID
CREATE INDEX IF NOT EXISTS idx_ach_stripe_transfer_id ON ach_transfers(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_ach_payroll_run ON ach_transfers(payroll_run_id);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_financial_account_id text DEFAULT '';
