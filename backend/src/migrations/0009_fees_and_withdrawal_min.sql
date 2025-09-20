-- Add fee breakdown fields to transactions and note withdrawal minimum
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paystack_fee NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_net NUMERIC(14,2) DEFAULT 0;

-- Helpful comment for admins: minimum withdrawal policy enforced in application (10 GHS)
COMMENT ON TABLE transactions IS 'Transactions table. Application enforces minimum tip=1 GHS and minimum withdrawal=10 GHS; fees stored in platform_fee, paystack_fee, creator_amount, platform_net.';
