// Basic Paystack helper functions
// Uses global fetch (Node 18+). Amounts expected in GHS (numeric) externally, converted to pesewas for Paystack.
import crypto from 'node:crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';

if (!PAYSTACK_SECRET_KEY) {
  console.warn('[paystack] PAYSTACK_SECRET_KEY not set – initialize payment route will fail until you add it to .env');
}

export function getPaystackPublicKey() { return PAYSTACK_PUBLIC_KEY; }

export async function initializePaystackTransaction({ amountGHS, email, reference, metadata = {} }) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack secret key missing');
  const body = {
    amount: Math.round(Number(amountGHS) * 100), // pesewas
    currency: 'GHS',
    email,
    reference,
    metadata,
  };
  const resp = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.status) {
    const err = new Error(json?.message || `Paystack init failed: ${resp.status}`);
    err.status = 502;
    throw err;
  }
  return json.data; // contains authorization_url, reference, access_code
}

// Verify webhook signature. Paystack sends x-paystack-signature = HMAC-SHA512(secret_key, raw_body)
export function verifyPaystackSignature(rawBody, signatureHeader) {
  if (!PAYSTACK_SECRET_KEY) return false;
  if (!rawBody || !signatureHeader) return false;
  try {
    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyBuf).digest('hex');
    return hmac === signatureHeader;
  } catch {
    return false;
  }
}

// Verify a transaction directly (useful before you set up webhooks)
export async function verifyPaystackTransaction(reference) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack secret key missing');
  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.status) {
    const err = new Error(json?.message || `Verify failed: ${resp.status}`);
    err.status = 502;
    throw err;
  }
  return json.data; // contains amount, status, reference, metadata, etc.
}
