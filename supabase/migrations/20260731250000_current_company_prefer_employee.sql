-- Prefer the company where the user is an active invited employee, then the
-- most recently joined company_users membership. Unordered LIMIT 1 caused
-- multi-company users (e.g. old sandbox owner + current employee) to resolve
-- the wrong company — empty subscription → false "Start Free Trial" banner.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT company_id FROM (
        -- 1) Active employee portal link (highest priority)
        SELECT e.company_id, 1 AS priority, e.created_at AS ts
        FROM public.employees e
        WHERE e.user_id = auth.uid() AND e.is_active = true

        UNION ALL

        -- 2) Company memberships, newest first
        SELECT cu.company_id, 2 AS priority, cu.created_at AS ts
        FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
    ) c
    ORDER BY priority ASC, ts DESC NULLS LAST
    LIMIT 1;
$$;
