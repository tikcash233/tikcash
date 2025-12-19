-- Recreate tikcash_vw_transaction_net view to use tikcash_ namespaced tables
BEGIN;

-- Ensure audit table exists under tikcash_ name (no-op if it already exists)
CREATE TABLE IF NOT EXISTS tikcash_transaction_fees (
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

-- Drop any old version of the view and recreate it against tikcash_ tables
DROP VIEW IF EXISTS tikcash_vw_transaction_net;

CREATE VIEW tikcash_vw_transaction_net AS
SELECT
  t.*,
  COALESCE(t.creator_amount, f.creator_amount,
           ROUND((t.amount - (t.amount * 0.18::numeric) - (t.amount * 0.02::numeric))::numeric, 2)
  ) AS net_to_creator,
  COALESCE(t.platform_fee, f.platform_fee,
           ROUND((t.amount * (0.18::numeric + 0.02::numeric)), 2)
  ) AS platform_fee_used
FROM tikcash_transactions t
LEFT JOIN tikcash_transaction_fees f ON f.transaction_id = t.id;

COMMIT;
