-- Allow rejected payroll runs (app reject flow). Keep existing statuses.

ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;

ALTER TABLE payroll_runs
    ADD CONSTRAINT payroll_runs_status_check
    CHECK (status = ANY (ARRAY[
        'draft'::text,
        'pending_approval'::text,
        'approved'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text,
        'rejected'::text
    ]));
