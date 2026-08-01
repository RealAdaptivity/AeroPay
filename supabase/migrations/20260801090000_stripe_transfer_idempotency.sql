-- Production hardening for Stripe Treasury payroll transfers.
-- One local transfer is allowed per payroll run + employee. This makes retries
-- and concurrent submissions converge on a single Stripe idempotency key.

ALTER TABLE public.ach_transfers
    ADD COLUMN IF NOT EXISTS idempotency_key text,
    ADD COLUMN IF NOT EXISTS stripe_event_id text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ach_transfers_payroll_employee_unique
    ON public.ach_transfers (payroll_run_id, employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS ach_transfers_stripe_transfer_unique
    ON public.ach_transfers (stripe_transfer_id)
    WHERE stripe_transfer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ach_transfers_stripe_event_unique
    ON public.ach_transfers (stripe_event_id)
    WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ach_transfers_status_updated_idx
    ON public.ach_transfers (status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_ach_transfers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ach_transfers_set_updated_at ON public.ach_transfers;
CREATE TRIGGER ach_transfers_set_updated_at
BEFORE UPDATE ON public.ach_transfers
FOR EACH ROW EXECUTE FUNCTION public.set_ach_transfers_updated_at();
