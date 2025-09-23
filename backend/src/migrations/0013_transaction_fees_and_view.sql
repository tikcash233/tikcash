-- Create a safe audit table for per-transaction fee breakdowns and a view that exposes net amounts
BEGIN;

-- Audit table: stores computed fees per transaction without modifying immutable transactions
CREATE TABLE IF NOT EXISTS transaction_fees (
  id serial PRIMARY KEY,
  transaction_id UUID NOT NULL,
  creator_id UUID,
  amount numeric(14,2),
  platform_fee numeric(14,2),
  paystack_fee numeric(14,2),
  creator_amount numeric(14,2),
  platform_net numeric(14,2),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);

-- View to present a single canonical net amount per transaction (prefer transaction.creator_amount, then audit table, then compute)
CREATE OR REPLACE VIEW vw_transaction_net AS
SELECT
  t.*, 
  -- Note: older deployments computed net using a 17% platform fee model. Current code uses 18% platform_net + 2% paystack model (20% total)
  COALESCE(t.creator_amount, f.creator_amount,
           ROUND((t.amount - (t.amount * 0.18::numeric) - (t.amount * 0.02::numeric))::numeric, 2)
  ) AS net_to_creator,
  COALESCE(t.platform_fee, f.platform_fee,
           ROUND((t.amount * (0.18::numeric + 0.02::numeric)), 2)
  ) AS platform_fee_used
FROM transactions t
LEFT JOIN transaction_fees f ON f.transaction_id = t.id;

COMMIT;

-- Note: This migration creates an audit table and a view. It does not change existing transactions.
