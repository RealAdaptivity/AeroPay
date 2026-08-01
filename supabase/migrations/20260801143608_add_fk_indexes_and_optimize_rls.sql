-- Keep auth lookups as init plans and avoid overlapping owner policies.
DROP POLICY IF EXISTS company_owner_access ON public.companies;
DROP POLICY IF EXISTS "Allow individual insert" ON public.companies;
CREATE POLICY companies_owner_insert ON public.companies FOR INSERT TO authenticated
  WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY companies_owner_update ON public.companies FOR UPDATE TO authenticated
  USING (owner_id=(SELECT auth.uid()))
  WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY companies_owner_delete ON public.companies FOR DELETE TO authenticated
  USING (owner_id=(SELECT auth.uid()));

DROP POLICY IF EXISTS employees_self_read ON public.employees;
CREATE POLICY employees_self_read ON public.employees FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));

-- Cover foreign keys used by tenant filters, joins, and cascade checks.
CREATE INDEX IF NOT EXISTS ach_transfers_company_id_idx ON public.ach_transfers(company_id);
CREATE INDEX IF NOT EXISTS ach_transfers_employee_id_idx ON public.ach_transfers(employee_id);
CREATE INDEX IF NOT EXISTS announcements_company_id_idx ON public.announcements(company_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS benefits_company_id_idx ON public.benefits(company_id);
CREATE INDEX IF NOT EXISTS companies_owner_id_idx ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS company_users_user_id_idx ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS filing_records_filed_by_idx ON public.filing_records(filed_by);
CREATE INDEX IF NOT EXISTS garnishments_company_id_idx ON public.garnishments(company_id);
CREATE INDEX IF NOT EXISTS onboarding_queue_company_id_idx ON public.onboarding_queue(company_id);
CREATE INDEX IF NOT EXISTS pay_advances_company_id_idx ON public.pay_advances(company_id);
CREATE INDEX IF NOT EXISTS pay_advances_payroll_run_id_idx ON public.pay_advances(payroll_run_id);
CREATE INDEX IF NOT EXISTS payroll_line_items_company_id_idx ON public.payroll_line_items(company_id);
CREATE INDEX IF NOT EXISTS payroll_runs_approved_by_idx ON public.payroll_runs(approved_by);
CREATE INDEX IF NOT EXISTS payroll_runs_submitted_by_idx ON public.payroll_runs(submitted_by);
CREATE INDEX IF NOT EXISTS pto_balances_company_id_idx ON public.pto_balances(company_id);
CREATE INDEX IF NOT EXISTS pto_requests_company_id_idx ON public.pto_requests(company_id);
CREATE INDEX IF NOT EXISTS sync_logs_payroll_run_id_idx ON public.sync_logs(payroll_run_id);
CREATE INDEX IF NOT EXISTS tax_filing_submissions_filed_by_idx ON public.tax_filing_submissions(filed_by);
CREATE INDEX IF NOT EXISTS timesheets_company_id_idx ON public.timesheets(company_id);
