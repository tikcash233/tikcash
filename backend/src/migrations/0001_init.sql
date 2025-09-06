-- Enable extension for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  bio TEXT,
  profile_image TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  phone_number TEXT,
  preferred_payment_method TEXT NOT NULL DEFAULT 'momo' CHECK (preferred_payment_method IN ('momo')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('comedy','dance','music','education','lifestyle','fashion','food','sports','other')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creators_category_idx ON creators(category);
CREATE INDEX IF NOT EXISTS creators_total_earnings_idx ON creators(total_earnings DESC);
CREATE INDEX IF NOT EXISTS creators_created_by_idx ON creators(created_by);
CREATE INDEX IF NOT EXISTS creators_email_idx ON creators(email);

-- transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  supporter_name TEXT,
  amount NUMERIC(14,2) NOT NULL,
  message TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('tip','withdrawal','refund')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  payment_reference TEXT,
  momo_number TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_creator_idx ON transactions(creator_id);
CREATE INDEX IF NOT EXISTS transactions_created_date_idx ON transactions(created_date DESC);
