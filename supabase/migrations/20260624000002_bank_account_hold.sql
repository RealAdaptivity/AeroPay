-- Track when an employee's bank account was linked so we can enforce a
-- 3-business-day hold before the first ACH disbursement.
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS bank_account_linked_at timestamptz;

-- Expose the hold status on ach_transfers for easy querying
-- (held = within hold window, processing = transfer submitted, etc.)
-- The status column already exists from migration 000000; 'held' is a new value.
