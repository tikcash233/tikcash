import { EventEmitter } from 'events';

// Global emitter for transaction + payment related events (SSE broadcasting)
export const txEvents = new EventEmitter();
// Unlimited listeners (many clients)
txEvents.setMaxListeners(0);

// Helper to emit a standardized transaction event
export function emitTransactionEvent(tx) {
  if (!tx) return;
  try {
    // Compute fees if missing so SSE always includes canonical net/gross values.
    // Uses same logic as models/transactions.js: platform 17%, paystack 2%, round 2 decimals.
    const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
    const computeFees = (amount) => {
      const a = Number(amount) || 0;
      const platformFeeRaw = a * 0.17;
      const paystackFeeRaw = a * 0.02;
      const creatorAmountRaw = a - platformFeeRaw;
      return {
        platform_fee: round2(platformFeeRaw),
        paystack_fee: round2(paystackFeeRaw),
        creator_amount: round2(creatorAmountRaw),
        platform_net: round2(platformFeeRaw - paystackFeeRaw),
      };
    };
    // Include both the raw amount (what supporter paid) and the creator_amount
    // (what the creator actually receives after platform fees). Frontend should
    // prefer creator_amount when updating balances or drawing earnings charts.
    let emittedCreatorAmount = tx.creator_amount != null ? Number(tx.creator_amount) : null;
    let emittedPlatformFee = tx.platform_fee != null ? Number(tx.platform_fee) : null;
    let emittedPaystackFee = tx.paystack_fee != null ? Number(tx.paystack_fee) : null;
    let emittedPlatformNet = tx.platform_net != null ? Number(tx.platform_net) : null;
    if (emittedCreatorAmount == null || emittedPlatformFee == null) {
      const fees = computeFees(tx.amount != null ? tx.amount : 0);
      if (emittedCreatorAmount == null) emittedCreatorAmount = fees.creator_amount;
      if (emittedPlatformFee == null) emittedPlatformFee = fees.platform_fee;
      if (emittedPaystackFee == null) emittedPaystackFee = fees.paystack_fee;
      if (emittedPlatformNet == null) emittedPlatformNet = fees.platform_net;
    }
    txEvents.emit('tx', {
      type: 'transaction.update',
      id: tx.id || null,
      reference: tx.payment_reference || null,
      status: tx.status || null,
      creator_id: tx.creator_id || null,
      amount: tx.amount != null ? Number(tx.amount) : null,
      creator_amount: emittedCreatorAmount,
      platform_fee: emittedPlatformFee,
      paystack_fee: emittedPaystackFee,
      supporter_name: tx.supporter_name || null,
      message: tx.message || null,
      transaction_type: tx.transaction_type || null,
      platform_net: emittedPlatformNet,
      at: new Date().toISOString()
    });
  } catch (e) {
    // swallow; SSE failures shouldn't crash app
    console.warn('[events] emit failed', e?.message || e);
  }
}
