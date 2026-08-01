-- These checks were added NOT VALID to avoid long blocking scans during the
-- initial hardening deploy. The sandbox data has now been checked against each
-- constraint, so complete validation in a separate, low-lock migration.
ALTER TABLE public.ach_transfers VALIDATE CONSTRAINT ach_transfers_positive_amount;
ALTER TABLE public.ach_transfers VALIDATE CONSTRAINT ach_transfers_status_valid;

ALTER TABLE public.employees VALIDATE CONSTRAINT employees_401k_valid;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_company_required;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_email_length;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_name_length;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_rate_valid;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_split_valid;

ALTER TABLE public.pay_advances VALIDATE CONSTRAINT pay_advances_amount_valid;
ALTER TABLE public.pay_advances VALIDATE CONSTRAINT pay_advances_keys_required;

ALTER TABLE public.payroll_line_items VALIDATE CONSTRAINT payroll_line_items_amounts_valid;
ALTER TABLE public.payroll_line_items VALIDATE CONSTRAINT payroll_line_items_keys_required;

ALTER TABLE public.payroll_runs VALIDATE CONSTRAINT payroll_runs_company_required;
ALTER TABLE public.payroll_runs VALIDATE CONSTRAINT payroll_runs_period_valid;
ALTER TABLE public.payroll_runs VALIDATE CONSTRAINT payroll_runs_totals_valid;

ALTER TABLE public.pto_requests VALIDATE CONSTRAINT pto_requests_dates_valid;
ALTER TABLE public.pto_requests VALIDATE CONSTRAINT pto_requests_hours_valid;
ALTER TABLE public.pto_requests VALIDATE CONSTRAINT pto_requests_keys_required;
ALTER TABLE public.pto_requests VALIDATE CONSTRAINT pto_requests_reason_length;

ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_agency_valid;
ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_amount_valid;
ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_form_ref_valid;
ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_form_type_valid;
ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_period_valid;
ALTER TABLE public.tax_filing_submissions VALIDATE CONSTRAINT tax_filing_status_valid;

ALTER TABLE public.timesheets VALIDATE CONSTRAINT timesheets_hours_valid;
ALTER TABLE public.timesheets VALIDATE CONSTRAINT timesheets_keys_required;
