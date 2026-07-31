-- Ensure w2_signatures exists and employees can read/write their own rows.
CREATE TABLE IF NOT EXISTS public.w2_signatures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    tax_year        integer NOT NULL,
    signature_data  text NOT NULL,
    ip_address      text,
    user_agent      text,
    signed_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (employee_id, tax_year)
);

CREATE INDEX IF NOT EXISTS w2_signatures_company_id_idx ON public.w2_signatures (company_id);
CREATE INDEX IF NOT EXISTS w2_signatures_employee_id_idx ON public.w2_signatures (employee_id);

ALTER TABLE public.w2_signatures ENABLE ROW LEVEL SECURITY;

-- Company admins (via current_company_id) can manage all signatures for the company.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'w2_signatures' AND policyname = 'w2_signatures_company'
    ) THEN
        CREATE POLICY w2_signatures_company ON public.w2_signatures
            FOR ALL
            USING (company_id = public.current_company_id())
            WITH CHECK (company_id = public.current_company_id());
    END IF;
END $$;

-- Employees can read/write only their own signature rows.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'w2_signatures' AND policyname = 'w2_signatures_self'
    ) THEN
        CREATE POLICY w2_signatures_self ON public.w2_signatures
            FOR ALL
            USING (
                employee_id IN (
                    SELECT id FROM public.employees WHERE user_id = auth.uid()
                )
            )
            WITH CHECK (
                employee_id IN (
                    SELECT id FROM public.employees WHERE user_id = auth.uid()
                )
                AND company_id = public.current_company_id()
            );
    END IF;
END $$;
