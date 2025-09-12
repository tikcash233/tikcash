-- Add idempotency support columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS paystack_authorization_url TEXT;

CREATE INDEX IF NOT EXISTS transactions_idem_idx ON transactions(creator_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
