-- Persist multi-step onboarding answers and link to created employee.

ALTER TABLE onboarding_queue
    ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS onboarding_queue_employee_id_idx
    ON onboarding_queue (employee_id)
    WHERE employee_id IS NOT NULL;
