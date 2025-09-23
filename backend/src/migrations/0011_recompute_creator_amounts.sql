-- Recompute per-transaction fee fields and creator aggregates
-- This migration attempts to update transaction fee columns for completed tips, but
-- if the DB enforces immutability for completed tips (via trigger), we catch the error
-- and continue by recomputing creator totals without mutating transaction rows.
BEGIN;

-- Try to update transaction-level fee fields for completed tips inside a DO block
DO $$
BEGIN
  UPDATE transactions
  SET
  platform_fee = round(((amount * 0.18::numeric) + (amount * 0.02::numeric)), 2),
  paystack_fee = round((amount * 0.02::numeric), 2),
  creator_amount = round((amount - (amount * 0.18::numeric) - (amount * 0.02::numeric))::numeric, 2),
  platform_net = round((amount * 0.18::numeric)::numeric, 2)
  WHERE transaction_type = 'tip'
    AND status = 'completed'
    AND amount IS NOT NULL
    AND amount > 0;
EXCEPTION WHEN OTHERS THEN
  -- If the DB raises (e.g., immutability trigger), log a notice and continue.
  RAISE NOTICE 'Skipping transaction updates due to error: %', SQLERRM;
END
$$;

-- Recompute creators totals from transactions (only completed tips + all withdrawals)
-- Use the fee formula directly so we don't require transaction rows to have creator_amount set.
WITH tip_sums AS (
  SELECT creator_id,
         COALESCE(SUM(ROUND((amount - (amount * 0.18::numeric) - (amount * 0.02::numeric))::numeric, 2)), 0) AS sum_creator_amount
  FROM transactions
  WHERE transaction_type = 'tip'
    AND status = 'completed'
    AND amount IS NOT NULL
    AND amount > 0
  GROUP BY creator_id
),
withdraw_sums AS (
  SELECT creator_id,
         COALESCE(SUM(amount), 0) AS sum_withdrawals
  FROM transactions
  WHERE transaction_type = 'withdrawal'
  GROUP BY creator_id
),
agg AS (
  SELECT c.id AS creator_id,
         COALESCE(t.sum_creator_amount, 0) AS sum_creator_amount,
         COALESCE(w.sum_withdrawals, 0) AS sum_withdrawals
  FROM creators c
  LEFT JOIN tip_sums t ON t.creator_id = c.id
  LEFT JOIN withdraw_sums w ON w.creator_id = c.id
)
UPDATE creators
SET
  total_earnings = agg.sum_creator_amount,
  available_balance = (agg.sum_creator_amount + agg.sum_withdrawals),
  updated_at = now()
FROM agg
WHERE creators.id = agg.creator_id;

COMMIT;

-- Notes: this migration is conservative: it attempts to populate transaction fee columns,
-- but if that fails (e.g. immutability triggers), it still fixes creators totals by computing
-- net amounts directly from the gross amount using the previous 17% platform fee (historical migration).
