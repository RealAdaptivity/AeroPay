-- Employee portal access: resolve company from employees.user_id and allow
-- company SELECT for members (not only owner_id).

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT company_id FROM (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
        UNION ALL
        SELECT company_id FROM public.employees WHERE user_id = auth.uid() AND is_active = true
    ) c
    LIMIT 1;
$$;

-- Members (admins + invited employees) can read their company row.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'company_members_select'
    ) THEN
        CREATE POLICY company_members_select ON public.companies
            FOR SELECT
            USING (id = public.current_company_id());
    END IF;
END $$;

-- Employees may read/write only their own timesheets (company-wide ALL remains for admins).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'timesheets' AND policyname = 'timesheets_self'
    ) THEN
        CREATE POLICY timesheets_self ON public.timesheets
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
            );
    END IF;
END $$;
