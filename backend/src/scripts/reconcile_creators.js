#!/usr/bin/env node
import { query, withTransaction } from '../db.js';

// Simple reconciliation script.
// Usage: node src/scripts/reconcile_creators.js         # preview only
//        node src/scripts/reconcile_creators.js --commit  # perform and commit

const commit = process.argv.includes('--commit');

async function preview() {
  // Count completed tips and sum of recomputed creator_amounts
  // Use WHERE-based aggregates for compatibility
  const counts = await query(`
    SELECT
      COUNT(*) AS completed_tips,
      COALESCE(SUM(ROUND((amount - (amount * 0.15::numeric) - (amount * 0.02::numeric))::numeric, 2)), 0) AS recomputed_creator_total
    FROM transactions
    WHERE transaction_type='tip' AND status='completed' AND amount > 0
  `);
  return counts.rows[0];
}

async function runCommit() {
  // First try the full update (transactions + creators). If DB prevents updating completed tips
  // (some installations enforce immutability via triggers), fallback to creators-only recompute.
  try {
    return await withTransaction(async (client) => {
      await client.query(`
        UPDATE transactions
        SET
          platform_fee = round(((amount * 0.15::numeric) + (amount * 0.02::numeric)), 2),
          paystack_fee = round((amount * 0.02::numeric), 2),
          creator_amount = round((amount - (amount * 0.15::numeric) - (amount * 0.02::numeric))::numeric, 2),
          platform_net = round((amount * 0.15::numeric)::numeric, 2)
        WHERE transaction_type = 'tip'
          AND status = 'completed'
          AND amount IS NOT NULL
          AND amount > 0
      `);

      await client.query(`
        WITH tip_sums AS (
          SELECT creator_id, COALESCE(SUM(creator_amount), 0) AS sum_creator_amount
          FROM transactions
          WHERE transaction_type = 'tip' AND status = 'completed'
          GROUP BY creator_id
        ),
        withdraw_sums AS (
          SELECT creator_id, COALESCE(SUM(amount), 0) AS sum_withdrawals
          FROM transactions
          WHERE transaction_type = 'withdrawal'
          GROUP BY creator_id
        ),
        agg AS (
          SELECT c.id AS creator_id, COALESCE(t.sum_creator_amount, 0) AS sum_creator_amount, COALESCE(w.sum_withdrawals, 0) AS sum_withdrawals
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
        WHERE creators.id = agg.creator_id
      `);
    });
  } catch (e) {
    console.warn('Full update failed, attempting creators-only recompute. Error:', e.message || e);
    // Fallback: recompute creators totals without touching transaction rows
    return withTransaction(async (client) => {
      await client.query(`
        WITH tip_calc AS (
     SELECT creator_id,
       COALESCE(SUM(ROUND((amount - (amount * 0.15::numeric) - (amount * 0.02::numeric))::numeric, 2)), 0) AS sum_creator_amount
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
        WHERE creators.id = agg.creator_id
      `);
    });
  }
}

async function main() {
  console.log('Previewing reconciliation...');
  const p = await preview();
  console.log('Completed tip rows:', p.completed_tips);
  // pg returns NUMERIC as string; coerce safely to Number for formatting
  const recomputedTotal = Number(p.recomputed_creator_total) || 0;
  console.log('Recomputed creator_amount total (sum of creator_amount on completed tips): GH₵', recomputedTotal.toFixed(2));

  if (!commit) {
    console.log('\nNo changes made. To apply changes run with --commit.');
    process.exit(0);
  }

  console.log('\nCommitting updates (this will modify transactions and creators).');
  try {
    await runCommit();
    console.log('Reconciliation committed successfully.');
  } catch (e) {
    console.error('Reconciliation failed:', e);
    process.exit(1);
  }
}

main().catch((e) => { console.error('Error', e); process.exit(1); });
