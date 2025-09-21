import { EventEmitter } from 'events';

// Global emitter for transaction + payment related events (SSE broadcasting)
export const txEvents = new EventEmitter();
// Unlimited listeners (many clients)
txEvents.setMaxListeners(0);

// Helper to emit a standardized transaction event
export function emitTransactionEvent(tx) {
  if (!tx) return;
  try {
    // Include both the raw amount (what supporter paid) and the creator_amount
    // (what the creator actually receives after platform fees). Frontend should
    // prefer creator_amount when updating balances or drawing earnings charts.
    txEvents.emit('tx', {
      type: 'transaction.update',
      id: tx.id || null,
      reference: tx.payment_reference || null,
      status: tx.status || null,
      creator_id: tx.creator_id || null,
      amount: tx.amount != null ? Number(tx.amount) : null,
      creator_amount: tx.creator_amount != null ? Number(tx.creator_amount) : null,
      platform_fee: tx.platform_fee != null ? Number(tx.platform_fee) : null,
      paystack_fee: tx.paystack_fee != null ? Number(tx.paystack_fee) : null,
      supporter_name: tx.supporter_name || null,
      message: tx.message || null,
      transaction_type: tx.transaction_type || null,
      at: new Date().toISOString()
    });
  } catch (e) {
    // swallow; SSE failures shouldn't crash app
    console.warn('[events] emit failed', e?.message || e);
  }
}
