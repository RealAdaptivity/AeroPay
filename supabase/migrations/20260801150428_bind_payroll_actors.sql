CREATE OR REPLACE FUNCTION private.guard_payroll_run_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'New payroll runs must start as draft or pending approval';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    NEW.submitted_by := auth.uid();
    NEW.submitted_at := coalesce(NEW.submitted_at,now());
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_payroll_run_insert ON public.payroll_runs;
CREATE TRIGGER guard_payroll_run_insert BEFORE INSERT ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION private.guard_payroll_run_insert();

CREATE OR REPLACE FUNCTION private.bind_payroll_approver()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','rejected')
     AND auth.uid() IS NOT NULL THEN
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bind_payroll_approver ON public.payroll_runs;
CREATE TRIGGER bind_payroll_approver BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION private.bind_payroll_approver();
