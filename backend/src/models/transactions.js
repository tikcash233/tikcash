import { query, withTransaction } from '../db.js';

export async function listTransactionsForCreator(creatorId, { limit = 50 } = {}) {
  const res = await query(
    'SELECT * FROM transactions WHERE creator_id = $1 ORDER BY created_date DESC LIMIT $2',
    [creatorId, limit]
  );
  return res.rows;
}

export async function createTransaction(data) {
  const fields = ['creator_id','supporter_name','amount','message','transaction_type','status','payment_reference','momo_number'];
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

// Atomic helper to apply a tip to creator balances and insert transaction
export async function createTipAndApply(data) {
  return withTransaction(async (client) => {
    // Basic business validation
    if (data.transaction_type === 'tip' && !(data.amount > 0)) {
      const err = new Error('Tip amount must be greater than 0');
      err.status = 400;
      throw err;
    }
    if (data.transaction_type === 'withdrawal' && !(data.amount < 0)) {
      const err = new Error('Withdrawal amount must be negative');
      err.status = 400;
      throw err;
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
    const txRes = await client.query(
      `INSERT INTO transactions(creator_id, supporter_name, amount, message, transaction_type, status, payment_reference, momo_number)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.creator_id, data.supporter_name || null, data.amount, data.message || null, data.transaction_type, status, data.payment_reference || null, data.momo_number || null]
    );
    const tx = txRes.rows[0];

    if (data.transaction_type === 'tip' && data.amount > 0) {
      await client.query(
        `UPDATE creators SET total_earnings = total_earnings + $1, available_balance = available_balance + $1, updated_at = now() WHERE id = $2`,
        [data.amount, data.creator_id]
      );
    }
    if (data.transaction_type === 'withdrawal' && data.amount < 0) {
      await client.query(
        `UPDATE creators SET available_balance = available_balance + $1, updated_at = now() WHERE id = $2`,
        [data.amount, data.creator_id]
      );
    }
    return tx;
  });
}
