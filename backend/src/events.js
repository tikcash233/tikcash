import { EventEmitter } from 'events';

// Global emitter for transaction + payment related events (SSE broadcasting)
export const txEvents = new EventEmitter();
// Unlimited listeners (many clients)
txEvents.setMaxListeners(0);

// Helper to emit a standardized transaction event
export function emitTransactionEvent(tx) {
  if (!tx) return;
  try {
    txEvents.emit('tx', {
      type: 'transaction.update',
      id: tx.id || null,
      reference: tx.payment_reference || null,
      status: tx.status || null,
      creator_id: tx.creator_id || null,
      amount: tx.amount != null ? Number(tx.amount) : null,
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
