-- Stripe Customer on the connected account for employee OutboundPayments.
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT '';
