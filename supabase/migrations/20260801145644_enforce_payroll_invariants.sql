-- Defensive constraints apply to new/changed rows without blocking deployment
-- on historical sandbox data. Validate them after the sandbox cleanup.
CREATE OR REPLACE FUNCTION private.valid_daily_hours(values_to_check numeric[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT cardinality(values_to_check)=7
    AND array_position(values_to_check,NULL) IS NULL
    AND coalesce((SELECT bool_and(v BETWEEN 0 AND 24) FROM unnest(values_to_check) v),false);
$$;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_company_required CHECK (company_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT employees_rate_valid CHECK (rate >= 0 AND rate <= 10000000) NOT VALID,
  ADD CONSTRAINT employees_401k_valid CHECK (coalesce(rate_401k,0) BETWEEN 0 AND 100) NOT VALID,
  ADD CONSTRAINT employees_split_valid CHECK (coalesce(split_savings_percent,0) BETWEEN 0 AND 100) NOT VALID,
  ADD CONSTRAINT employees_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT employees_email_length CHECK (length(email) BETWEEN 3 AND 320) NOT VALID;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_company_required CHECK (company_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT payroll_runs_period_valid CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end) NOT VALID,
  ADD CONSTRAINT payroll_runs_totals_valid CHECK (
    coalesce(gross_payroll,0) >= 0 AND coalesce(employer_taxes,0) >= 0
    AND coalesce(total_cost,0) >= 0 AND coalesce(employee_count,0) >= 0
  ) NOT VALID;

ALTER TABLE public.payroll_line_items
  ADD CONSTRAINT payroll_line_items_keys_required CHECK (
    payroll_run_id IS NOT NULL AND employee_id IS NOT NULL AND company_id IS NOT NULL
  ) NOT VALID,
  ADD CONSTRAINT payroll_line_items_amounts_valid CHECK (
    coalesce(gross_pay,0) >= 0 AND coalesce(net_pay,0) >= 0
    AND coalesce(total_employee_taxes,0) >= 0
    AND coalesce(total_employer_taxes,0) >= 0
    AND coalesce(total_payroll_cost,0) >= 0
  ) NOT VALID;

ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_keys_required CHECK (company_id IS NOT NULL AND employee_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT timesheets_hours_valid CHECK (
    hours IS NOT NULL AND private.valid_daily_hours(hours)
  ) NOT VALID;

ALTER TABLE public.pto_requests
  ADD CONSTRAINT pto_requests_keys_required CHECK (company_id IS NOT NULL AND employee_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT pto_requests_dates_valid CHECK (start_date <= end_date) NOT VALID,
  ADD CONSTRAINT pto_requests_hours_valid CHECK (hours > 0 AND hours <= 2080) NOT VALID,
  ADD CONSTRAINT pto_requests_reason_length CHECK (reason IS NULL OR length(reason) <= 2000) NOT VALID;

ALTER TABLE public.pay_advances
  ADD CONSTRAINT pay_advances_keys_required CHECK (company_id IS NOT NULL AND employee_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT pay_advances_amount_valid CHECK (amount > 0 AND amount <= 1000000) NOT VALID;

ALTER TABLE public.ach_transfers
  ADD CONSTRAINT ach_transfers_status_valid CHECK (
    status IN ('pending','held','processing','succeeded','failed','canceled','returned')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION private.guard_payroll_run_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF OLD.status IN ('completed','rejected','failed') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Terminal payroll runs are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='draft' AND NEW.status='pending_approval') OR
    (OLD.status IN ('pending_approval','approved','processing') AND NEW.status='completed') OR
    (OLD.status='pending_approval' AND NEW.status='rejected') OR
    (OLD.status IN ('approved','processing') AND NEW.status='failed')
  ) THEN
    RAISE EXCEPTION 'Invalid payroll transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.company_id, NEW.period_start, NEW.period_end, NEW.gross_payroll,
    NEW.employer_taxes, NEW.total_cost, NEW.employee_count, NEW.run_type
  ) IS DISTINCT FROM (
    OLD.company_id, OLD.period_start, OLD.period_end, OLD.gross_payroll,
    OLD.employer_taxes, OLD.total_cost, OLD.employee_count, OLD.run_type
  ) THEN
    RAISE EXCEPTION 'Submitted payroll financial fields are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_payroll_run_update ON public.payroll_runs;
CREATE TRIGGER guard_payroll_run_update BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION private.guard_payroll_run_update();

CREATE OR REPLACE FUNCTION private.guard_payroll_line_item()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE run_row public.payroll_runs%ROWTYPE; employee_company uuid;
BEGIN
  SELECT * INTO run_row FROM public.payroll_runs WHERE id=coalesce(NEW.payroll_run_id,OLD.payroll_run_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND run_row.status IN ('completed','rejected','failed') THEN
    RAISE EXCEPTION 'Line items for terminal payroll runs are immutable';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT company_id INTO employee_company FROM public.employees WHERE id=NEW.employee_id;
    IF run_row.company_id IS DISTINCT FROM NEW.company_id OR employee_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Payroll line item tenant mismatch';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_payroll_line_item ON public.payroll_line_items;
CREATE TRIGGER guard_payroll_line_item BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_line_items
FOR EACH ROW EXECUTE FUNCTION private.guard_payroll_line_item();

CREATE OR REPLACE FUNCTION private.guard_employee_tenant_row()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE employee_company uuid;
BEGIN
  SELECT company_id INTO employee_company FROM public.employees WHERE id=NEW.employee_id;
  IF employee_company IS NULL OR employee_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Employee record tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_timesheet_tenant ON public.timesheets;
CREATE TRIGGER guard_timesheet_tenant BEFORE INSERT OR UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION private.guard_employee_tenant_row();
DROP TRIGGER IF EXISTS guard_pto_request_tenant ON public.pto_requests;
CREATE TRIGGER guard_pto_request_tenant BEFORE INSERT OR UPDATE ON public.pto_requests
FOR EACH ROW EXECUTE FUNCTION private.guard_employee_tenant_row();
DROP TRIGGER IF EXISTS guard_pay_advance_tenant ON public.pay_advances;
CREATE TRIGGER guard_pay_advance_tenant BEFORE INSERT OR UPDATE ON public.pay_advances
FOR EACH ROW EXECUTE FUNCTION private.guard_employee_tenant_row();

-- Fixed-window rate limiter for authenticated Edge operations. Only service_role
-- may invoke the exposed RPC; callers cannot manipulate counters directly.
CREATE TABLE IF NOT EXISTS private.edge_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  actor_id uuid, action_name text, max_requests integer, window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result_count integer;
BEGIN
  IF actor_id IS NULL OR length(action_name) NOT BETWEEN 1 AND 80
     OR max_requests NOT BETWEEN 1 AND 1000 OR window_seconds NOT BETWEEN 1 AND 86400 THEN
    RETURN false;
  END IF;
  INSERT INTO private.edge_rate_limits(bucket_key,window_started_at,request_count,updated_at)
  VALUES (actor_id::text || ':' || action_name, now(), 1, now())
  ON CONFLICT (bucket_key) DO UPDATE SET
    window_started_at=CASE WHEN private.edge_rate_limits.window_started_at <= now()-make_interval(secs=>window_seconds)
      THEN now() ELSE private.edge_rate_limits.window_started_at END,
    request_count=CASE WHEN private.edge_rate_limits.window_started_at <= now()-make_interval(secs=>window_seconds)
      THEN 1 ELSE private.edge_rate_limits.request_count+1 END,
    updated_at=now()
  RETURNING request_count INTO result_count;
  RETURN result_count <= max_requests;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(uuid,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(uuid,text,integer,integer) TO service_role;
