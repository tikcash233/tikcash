// Admin: Approve withdrawal (mark as sent)
export async function approveWithdrawal(withdrawalId) {
  // Only allow approving withdrawals that are currently pending
  const res = await query(
    `UPDATE transactions SET status = 'approved' WHERE id = $1 AND transaction_type = 'withdrawal' AND status = 'pending' RETURNING *`,
    [withdrawalId]
  );
  return res.rows[0] || null;
}
import { query, withTransaction } from '../db.js';
import { emitTransactionEvent } from '../events.js';
import { parseNumericFields } from '../utils.js';

export async function listTransactionsForCreator(creatorId, { limit = 50, includeExpired = false } = {}) {
  // If limit is null or the string 'all', return full history (no LIMIT clause)
  const unlimited = limit === null || limit === 'all';
  let sql = 'SELECT * FROM transactions WHERE creator_id = $1';
  const params = [creatorId];

  // Hide all pending and expired tips unless explicitly requested
  if (!includeExpired) {
    sql += ` AND status NOT IN (\'pending\', \'expired\')`;
  }

  sql += ' ORDER BY created_date DESC';
  if (!unlimited) {
    sql += ' LIMIT $2';
    params.push(limit);
  }

  const res = await query(sql, params);
  return res.rows;
}

export async function createTransaction(data) {
  const fields = ['creator_id','supporter_name','amount','message','transaction_type','status','payment_reference','momo_number','idempotency_key','paystack_authorization_url','supporter_user_id'];
  const cols = [];
  const vals = [];
  const params = [];
  fields.forEach((k) => {
    if (data[k] !== undefined) {
      cols.push(k);
      params.push(data[k]);
      vals.push(`$${params.length}`);
    }
  });
  const sql = `INSERT INTO transactions(${cols.join(',')}) VALUES(${vals.join(',')}) RETURNING *`;
  const res = await query(sql, params);
  return res.rows[0];
}

// Helper to compute fees. All amounts are numbers (GHS). Returns rounded 2-decimal values.
// New model: platform should receive 15% of the gross tip (platform_net = 15% of amount).
// Paystack charges 2% of the gross amount. Creator receives the remainder after both fees.
function computeFees(amount) {
  const a = Number(amount) || 0;
  // platform target net: 15% of gross
  const platformNetRaw = a * 0.15;
  // Paystack processor fee: 2% of gross (borne by platform)
  const paystackFeeRaw = a * 0.02;
  // Creator receives gross minus platform_net and paystack fee
  const creatorAmountRaw = a - platformNetRaw - paystackFeeRaw;

  // Round to 2 decimals (financial rounding via cents)
  const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  const platform_fee = round2(platformNetRaw + paystackFeeRaw); // stored platform_fee column keeps gross platform take (incl. paystack cost)
  const paystack_fee = round2(paystackFeeRaw);
  const creator_amount = round2(creatorAmountRaw);
  const platform_net = round2(platformNetRaw); // what platform actually nets/receives
  return { platform_fee, paystack_fee, creator_amount, platform_net };
}

export async function getByIdempotency(creatorId, key) {
  if (!creatorId || !key) return null;
  const r = await query('SELECT * FROM transactions WHERE creator_id=$1 AND idempotency_key=$2 LIMIT 1', [creatorId, key]);
  return r.rows[0] || null;
}

export async function attachAuthorizationUrl(transactionId, url) {
  if (!transactionId || !url) return;
  await query('UPDATE transactions SET paystack_authorization_url=$2 WHERE id=$1', [transactionId, url]);
}

// Atomic helper to apply a tip to creator balances and insert transaction
export async function createTipAndApply(data) {
  return withTransaction(async (client) => {
    // Basic business validation
    if (data.transaction_type === 'tip' && !(data.amount > 0)) {
      const err = new Error('Tip amount must be greater than 0');
      err.status = 400;
      throw err;
    }
    // Enforce minimum tip (1 GHS)
    if (data.transaction_type === 'tip' && Number(data.amount) < 1) {
      const err = new Error('Minimum tip is 1 GHS');
      err.status = 400;
      throw err;
    }
    if (data.transaction_type === 'withdrawal' && !(data.amount < 0)) {
      const err = new Error('Withdrawal amount must be negative');
      err.status = 400;
      throw err;
    }

    // Enforce minimum withdrawal absolute value (10 GHS)
    if (data.transaction_type === 'withdrawal') {
      const withdrawAbs = Math.abs(Number(data.amount));
      if (withdrawAbs < 10) {
        const err = new Error('Minimum withdrawal is 10 GHS');
        err.status = 400;
        throw err;
      }
    }

    // Lock creator row during balance update
    const cr = await client.query('SELECT id, available_balance FROM creators WHERE id = $1 FOR UPDATE', [data.creator_id]);
    if (cr.rowCount === 0) {
      const err = new Error('Creator not found');
      err.status = 404;
      throw err;
    }
    const currentAvail = Number(cr.rows[0].available_balance);
    if (data.transaction_type === 'withdrawal') {
      const withdrawAbs = Math.abs(Number(data.amount));
      if (withdrawAbs > currentAvail) {
        const err = new Error('Insufficient balance for withdrawal');
        err.status = 400;
        throw err;
      }
    }

    const status = data.status || (data.transaction_type === 'tip' ? 'completed' : 'pending');
    // Compute fees for tips; withdrawals don't carry fees here
    let fees = { platform_fee: 0, paystack_fee: 0, creator_amount: Number(data.amount), platform_net: 0 };
    if (data.transaction_type === 'tip' && Number(data.amount) > 0) {
      fees = computeFees(Number(data.amount));
    }

    const txRes = await client.query(
      `INSERT INTO transactions(creator_id, supporter_name, amount, message, transaction_type, status, payment_reference, momo_number, supporter_user_id, platform_fee, paystack_fee, creator_amount, platform_net)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [data.creator_id, data.supporter_name || null, data.amount, data.message || null, data.transaction_type, status, data.payment_reference || null, data.momo_number || null, data.supporter_user_id || null, fees.platform_fee, fees.paystack_fee, fees.creator_amount, fees.platform_net]
    );
    const tx = txRes.rows[0];

    

    if (data.transaction_type === 'tip' && Number(data.amount) > 0) {
      // Apply only the creator's share to balances
      const creatorShare = fees.creator_amount;
      await client.query(
        `UPDATE creators SET total_earnings = total_earnings + $1, available_balance = available_balance + $1, updated_at = now() WHERE id = $2`,
        [creatorShare, data.creator_id]
      );
    }
    if (data.transaction_type === 'withdrawal' && data.amount < 0) {
      await client.query(
        `UPDATE creators SET available_balance = available_balance + $1, updated_at = now() WHERE id = $2`,
        [data.amount, data.creator_id]
      );
    }
    // Emit SSE so clients receive real-time updates (including creator_amount)
    try { emitTransactionEvent(tx); } catch (e) { /* swallow */ }
    return tx;
  });
}

// Fetch by Paystack reference
export async function getTransactionByReference(reference) {
  const res = await query('SELECT * FROM transactions WHERE payment_reference = $1 LIMIT 1', [reference]);
  return res.rows[0] || null;
}

// Complete an existing pending tip (created before redirect) and apply balance increase atomically.
export async function completePendingTip(reference, amount) {
  return withTransaction(async (client) => {
    const tr = await client.query('SELECT * FROM transactions WHERE payment_reference = $1 FOR UPDATE', [reference]);
    if (tr.rowCount === 0) return null; // not found
    const tx = tr.rows[0];
    if (tx.status !== 'pending') return tx; // already processed
    // Update transaction (ensure amount is set in case it was 0)
    // Compute fees and creator share for the finalized amount
    const finalAmount = Number(amount);
    const fees = (finalAmount > 0) ? computeFees(finalAmount) : { platform_fee: 0, paystack_fee: 0, creator_amount: finalAmount, platform_net: 0 };
  await client.query('UPDATE transactions SET status = $2, amount = $3, platform_fee = $4, paystack_fee = $5, creator_amount = $6, platform_net = $7 WHERE id = $1', [tx.id, 'completed', finalAmount, fees.platform_fee, fees.paystack_fee, fees.creator_amount, fees.platform_net]);
    // Apply to creator balances (only their share)
    if (finalAmount > 0) {
      await client.query('UPDATE creators SET total_earnings = total_earnings + $1, available_balance = available_balance + $1, updated_at = now() WHERE id = $2', [fees.creator_amount, tx.creator_id]);
    }
    try {
      const updated = await client.query('SELECT * FROM transactions WHERE id = $1', [tx.id]);
      const finalTx = updated.rows[0];
      try { emitTransactionEvent(finalTx); } catch (e) { /* swallow */ }
      return finalTx;
    } catch (e) {
      // If selecting back the transaction failed, still return a minimal object
      try { emitTransactionEvent({ id: tx.id, status: 'completed', transaction_type: 'tip' }); } catch (__) {}
      return { id: tx.id, status: 'completed' };
    }
  });
}


// Fetch creators supported by a specific user (from their successful transactions)
export async function listCreatorsSupportedByUser(userId, { page = 1, limit = 24 } = {}) {
  const offset = (page - 1) * limit;
  const res = await query(
    `SELECT 
        c.id,
        c.tiktok_username,
        c.display_name,
        c.profile_image,
        c.bio,
        c.category,
        MAX(t.created_date) AS last_supported_at,
        COUNT(t.id) AS support_count,
        SUM(t.amount) AS total_supported
     FROM creators c
     INNER JOIN transactions t ON c.id = t.creator_id
     WHERE t.supporter_user_id = $1 
       AND t.status = 'completed' 
       AND t.transaction_type = 'tip'
     GROUP BY c.id, c.tiktok_username, c.display_name, c.profile_image, c.bio, c.category
     ORDER BY last_supported_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return res.rows.map(r => parseNumericFields(r, ['total_supported']));
}

// Cleanup function to mark old pending tips as expired/cancelled
export async function expireOldPendingTips() {
  try {
    const result = await query(
      `UPDATE transactions 
       SET status = 'expired' 
       WHERE status = 'pending' 
       AND transaction_type = 'tip' 
       AND created_date < NOW() - INTERVAL '30 minutes'
       RETURNING id, payment_reference, creator_id`,
      []
    );
    
    // Emit events for expired tips so frontend can update
    for (const tx of result.rows) {
      emitTransactionEvent({
        ...tx,
        status: 'expired',
        transaction_type: 'tip'
      });
    }
    
    const ENABLE_CLEANUP_LOGS = (process.env.ENABLE_CLEANUP_LOGS || '').toLowerCase() === 'true';
    // Removed noisy cleanup log
    
    return result.rowCount;
  } catch (error) {
    console.error('[cleanup] Failed to expire old pending tips:', error);
    return 0;
  }
}
