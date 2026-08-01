-- Keep this SECURITY DEFINER helper available to authenticated RLS policies,
-- but prevent anonymous PostgREST RPC access.
REVOKE EXECUTE ON FUNCTION public.is_company_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, service_role;
