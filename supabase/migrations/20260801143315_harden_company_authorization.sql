-- Separate company membership from company administration. Legacy policies
-- used current_company_id() for ALL operations, which allowed an employee to
-- administer company-wide payroll data.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = target_company_id AND cu.user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.employees e
    WHERE e.company_id = target_company_id
      AND e.user_id = auth.uid() AND e.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.is_company_admin(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = target_company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('owner', 'admin', 'accountant')
  );
$$;

REVOKE ALL ON FUNCTION private.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_company_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_company_admin(uuid) TO authenticated, service_role;

-- Membership records: users can read their own membership; admins can manage
-- their company. Self-service owner creation is allowed only for a company the
-- same user has just created.
DROP POLICY IF EXISTS "Allow individual insert" ON public.company_users;
DROP POLICY IF EXISTS company_users_same_company ON public.company_users;
CREATE POLICY company_users_read ON public.company_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_company_admin(company_id));
CREATE POLICY company_users_owner_bootstrap ON public.company_users FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND role = 'owner' AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = (SELECT auth.uid())
    )
  );
CREATE POLICY company_users_admin_insert ON public.company_users FOR INSERT TO authenticated
  WITH CHECK (private.is_company_admin(company_id) AND role IN ('owner','admin','accountant','employee'));
CREATE POLICY company_users_admin_update ON public.company_users FOR UPDATE TO authenticated
  USING (private.is_company_admin(company_id))
  WITH CHECK (private.is_company_admin(company_id) AND role IN ('owner','admin','accountant','employee'));
CREATE POLICY company_users_admin_delete ON public.company_users FOR DELETE TO authenticated
  USING (private.is_company_admin(company_id));

-- Company and announcement visibility is available to members; writes remain
-- administrative.
DROP POLICY IF EXISTS company_members_select ON public.companies;
CREATE POLICY company_members_select ON public.companies FOR SELECT TO authenticated
  USING (private.is_company_member(id));
DROP POLICY IF EXISTS announcements_read ON public.announcements;
DROP POLICY IF EXISTS announcements_write ON public.announcements;
CREATE POLICY announcements_read ON public.announcements FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));
CREATE POLICY announcements_write ON public.announcements FOR ALL TO authenticated
  USING (private.is_company_admin(company_id))
  WITH CHECK (private.is_company_admin(company_id));

-- Replace broad company-wide ALL policies with explicit administrator checks.
DO $policy$
DECLARE
  item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('benefits','benefits_company'),
    ('filing_records','filing_records_company'),
    ('garnishments','garnishments_company'),
    ('integrations','integrations_company'),
    ('onboarding_queue','onboarding_company'),
    ('pay_advances','pay_advances_company'),
    ('payroll_line_items','payroll_line_items_company'),
    ('payroll_runs','payroll_runs_company'),
    ('pto_balances','pto_balances_company'),
    ('pto_requests','pto_requests_company'),
    ('sync_logs','sync_logs_company'),
    ('timesheets','timesheets_company'),
    ('tax_filing_submissions','company_own_tax_filings'),
    ('w2_signatures','w2_signatures_company')
  ) AS policies(table_name, old_policy)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', item.old_policy, item.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.is_company_admin(company_id)) WITH CHECK (private.is_company_admin(company_id))',
      item.table_name || '_admin', item.table_name
    );
  END LOOP;
END
$policy$;

-- Employees can see only their own employee-scoped records.
DROP POLICY IF EXISTS benefits_self ON public.benefits;
CREATE POLICY benefits_self ON public.benefits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS payroll_line_items_self ON public.payroll_line_items;
CREATE POLICY payroll_line_items_self ON public.payroll_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS pto_balances_self ON public.pto_balances;
CREATE POLICY pto_balances_self ON public.pto_balances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())));

-- Requests are employee-created but only administrators may change status.
DROP POLICY IF EXISTS pay_advances_self ON public.pay_advances;
CREATE POLICY pay_advances_self_read ON public.pay_advances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())));
CREATE POLICY pay_advances_self_insert ON public.pay_advances FOR INSERT TO authenticated
  WITH CHECK (status='pending' AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id=employee_id AND e.company_id=company_id AND e.user_id=(SELECT auth.uid())
  ));
DROP POLICY IF EXISTS pto_requests_self ON public.pto_requests;
CREATE POLICY pto_requests_self_read ON public.pto_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())));
CREATE POLICY pto_requests_self_insert ON public.pto_requests FOR INSERT TO authenticated
  WITH CHECK (status='pending' AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id=employee_id AND e.company_id=company_id AND e.user_id=(SELECT auth.uid())
  ));

-- Employees can maintain their own timecards and signatures, but cannot move
-- those rows to another employee or company.
DROP POLICY IF EXISTS timesheets_self ON public.timesheets;
CREATE POLICY timesheets_self ON public.timesheets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id=employee_id AND e.company_id=company_id AND e.user_id=(SELECT auth.uid())
  ));
DROP POLICY IF EXISTS w2_signatures_self ON public.w2_signatures;
CREATE POLICY w2_signatures_self ON public.w2_signatures FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id=employee_id AND e.company_id=company_id AND e.user_id=(SELECT auth.uid())
  ));
DROP POLICY IF EXISTS w2_signatures_admin_read ON public.w2_signatures;

-- Audit records are append-only from clients. The actor must be the caller;
-- company-wide reading is restricted to administrators.
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
DROP POLICY IF EXISTS audit_log_read ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id) AND actor_id=(SELECT auth.uid()));
CREATE POLICY audit_log_read ON public.audit_log FOR SELECT TO authenticated
  USING (private.is_company_admin(company_id));

-- The employee directory is company-confidential. Employee self-read remains,
-- while company-wide management requires a role in that exact company.
DROP POLICY IF EXISTS employees_admin ON public.employees;
CREATE POLICY employees_admin ON public.employees FOR ALL TO authenticated
  USING (private.is_company_admin(company_id))
  WITH CHECK (private.is_company_admin(company_id));

-- Legacy policies were created for PUBLIC. Even where auth.uid() made anonymous
-- access evaluate false, target only authenticated explicitly to avoid future
-- policy edits accidentally exposing the Data API.
DO $roles$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND roles='{public}'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', item.policyname, item.tablename);
  END LOOP;
END
$roles$;
