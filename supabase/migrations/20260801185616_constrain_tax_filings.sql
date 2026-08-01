ALTER TABLE public.tax_filing_submissions
  ADD CONSTRAINT tax_filing_form_ref_valid CHECK (
    length(btrim(form_ref)) BETWEEN 1 AND 100
  ) NOT VALID,
  ADD CONSTRAINT tax_filing_form_type_valid CHECK (
    length(btrim(form_type)) BETWEEN 1 AND 100
  ) NOT VALID,
  ADD CONSTRAINT tax_filing_period_valid CHECK (length(period) <= 50) NOT VALID,
  ADD CONSTRAINT tax_filing_agency_valid CHECK (length(agency) <= 100) NOT VALID,
  ADD CONSTRAINT tax_filing_amount_valid CHECK (amount BETWEEN 0 AND 1000000000) NOT VALID,
  ADD CONSTRAINT tax_filing_status_valid CHECK (
    status IN ('submitting','submitted','accepted','rejected','error')
  ) NOT VALID;
