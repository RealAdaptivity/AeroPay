DROP POLICY IF EXISTS employees_admin ON public.employees;
CREATE POLICY employees_admin ON public.employees FOR ALL TO authenticated
  USING (private.is_company_admin(company_id))
  WITH CHECK (private.is_company_admin(company_id));

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
