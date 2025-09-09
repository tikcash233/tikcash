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
      reference: tx.payment_reference,
      status: tx.status,
      creator_id: tx.creator_id,
      amount: Number(tx.amount),
      at: new Date().toISOString()
    });
  } catch (e) {
    // swallow; SSE failures shouldn't crash app
    console.warn('[events] emit failed', e?.message || e);
  }
}
