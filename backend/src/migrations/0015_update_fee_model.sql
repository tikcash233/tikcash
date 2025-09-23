-- Migration 0015: Fee model migration (now using platform_net=18% and paystack_fee=2%)
-- This migration recomputes transaction fee fields and updates creators aggregates using
-- the model: platform_net = round(amount * 0.18, 2), paystack_fee = round(amount * 0.02, 2),
-- creator_amount = round(amount - platform_net - paystack_fee, 2), and platform_fee = platform_net + paystack_fee.
BEGIN;

-- Update transaction fee fields for completed tips
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
  RAISE NOTICE 'Skipping transaction updates due to error: %', SQLERRM;
END
$$;

-- Recompute creators totals from transactions using new formula
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
