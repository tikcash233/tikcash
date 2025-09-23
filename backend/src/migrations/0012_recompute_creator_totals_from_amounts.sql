BEGIN;

-- Compute per-creator sums using the fee formula but do NOT update transactions.
-- Note: current model uses platform_net=18% and paystack_fee=2% (20% total). Older metadata may reflect prior models.
WITH tip_calc AS (
  SELECT creator_id,
         -- Current model: platform 18% + processor 2% (net to creator = amount - 18% - 2%).
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
  LEFT JOIN tip_calc t ON t.creator_id = c.id
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

