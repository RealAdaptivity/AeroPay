-- Stripe sandbox safety: duplicate-event tracking and one payout per employee/run.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id       text PRIMARY KEY,
    event_type     text NOT NULL,
    object_id      text,
    status         text NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'processed', 'failed')),
    attempts       integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
    last_error     text,
    received_at    timestamptz NOT NULL DEFAULT now(),
    processed_at   timestamptz,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
    ON public.stripe_webhook_events (status, updated_at);

-- A payroll approval can be retried safely, but it must never create a second
-- payout for the same employee and payroll run. The nullable key avoids making
-- historical sandbox duplicates block this migration.
ALTER TABLE public.ach_transfers
    ADD COLUMN IF NOT EXISTS operation_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ach_transfers_operation_key_uidx
    ON public.ach_transfers (operation_key)
    WHERE operation_key IS NOT NULL;

ALTER TABLE public.ach_transfers
    DROP CONSTRAINT IF EXISTS ach_transfers_positive_amount;
ALTER TABLE public.ach_transfers
    ADD CONSTRAINT ach_transfers_positive_amount CHECK (amount_cents > 0) NOT VALID;

-- ACH ledger rows are written only by service-role Edge Functions. Company
-- owners/admins can read them through RLS; employees and anonymous users cannot.
DROP POLICY IF EXISTS "company_own_ach" ON public.ach_transfers;
CREATE POLICY "company_admins_read_ach"
    ON public.ach_transfers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company_users cu
            WHERE cu.company_id = ach_transfers.company_id
              AND cu.user_id = (SELECT auth.uid())
              AND cu.role IN ('owner', 'admin')
        )
    );

REVOKE ALL ON public.ach_transfers FROM anon, authenticated;
GRANT SELECT ON public.ach_transfers TO authenticated;

-- This privileged helper is needed by authenticated RLS policies, but should
-- not inherit PostgreSQL's default EXECUTE grant to every role.
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, service_role;

-- This helper is likewise used by authenticated RLS policies only.
REVOKE EXECUTE ON FUNCTION public.is_company_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, service_role;
