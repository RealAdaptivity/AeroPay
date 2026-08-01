DROP POLICY IF EXISTS subscription_read ON public.subscriptions;
CREATE POLICY subscription_read ON public.subscriptions FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

-- All RLS policies now use helpers in the unexposed private schema.
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_admin() FROM authenticated;
