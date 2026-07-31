-- Smart Autopilot / auto-payroll schedule on companies.
-- Columns may already exist in production; IF NOT EXISTS keeps this idempotent.

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS auto_payroll_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_payroll_mode text DEFAULT 'reminder',
    ADD COLUMN IF NOT EXISTS auto_payroll_frequency text DEFAULT 'biweekly',
    ADD COLUMN IF NOT EXISTS auto_payroll_day_of_week integer DEFAULT 5,
    ADD COLUMN IF NOT EXISTS auto_payroll_day_of_month integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS auto_payroll_next_run date,
    ADD COLUMN IF NOT EXISTS auto_payroll_last_run date,
    ADD COLUMN IF NOT EXISTS auto_payroll_reminder_days_before integer DEFAULT 2;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'companies_auto_payroll_mode_check'
    ) THEN
        ALTER TABLE companies
            ADD CONSTRAINT companies_auto_payroll_mode_check
            CHECK (auto_payroll_mode = ANY (ARRAY['reminder'::text, 'auto_submit'::text]));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'companies_auto_payroll_frequency_check'
    ) THEN
        ALTER TABLE companies
            ADD CONSTRAINT companies_auto_payroll_frequency_check
            CHECK (auto_payroll_frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semimonthly'::text, 'monthly'::text]));
    END IF;
END $$;
