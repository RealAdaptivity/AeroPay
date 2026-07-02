-- E-file: track tax filings submitted to a third-party e-file provider.
-- A submission is created when an admin clicks "E-File" on a filing row; its
-- status is then updated as the provider transmits to the IRS/SSA/state agency.
CREATE TABLE IF NOT EXISTS tax_filing_submissions (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    form_ref               text NOT NULL,              -- calendar id, e.g. 941-Q1 2026
    form_type              text NOT NULL,              -- Form 941 | W-2 / W-3 | 1099-NEC | Form 940
    period                 text NOT NULL,
    agency                 text NOT NULL,              -- IRS | SSA / IRS | ...
    amount                 numeric NOT NULL DEFAULT 0,
    provider               text,                       -- e-file provider name
    provider_submission_id text,                       -- provider's tracking id
    status                 text NOT NULL DEFAULT 'submitting',
    -- submitting | submitted | accepted | rejected | error
    status_detail          text,                       -- provider message / rejection reason
    submitted_at           timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    filed_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE tax_filing_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_own_tax_filings" ON tax_filing_submissions
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- One active submission per form period; re-filing updates the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_filing_company_ref
    ON tax_filing_submissions(company_id, form_ref);
CREATE INDEX IF NOT EXISTS idx_tax_filing_provider_id
    ON tax_filing_submissions(provider_submission_id);
