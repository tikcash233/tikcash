-- Recompute creator totals from transaction.amount without mutating transaction rows
-- This is a conservative migration for databases where completed tips are immutable.
BEGIN;

-- Compute per-creator sums using the fee formula (17% platform fee) but do NOT update transactions.
WITH tip_calc AS (
  SELECT creator_id,
         COALESCE(SUM(ROUND((amount - (amount * 0.17::numeric))::numeric, 2)), 0) AS sum_creator_amount
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

-- Note: This migration intentionally avoids changing transaction rows in case the DB enforces immutability
-- or other constraints. It recomputes creator totals from existing transaction.amount values.
