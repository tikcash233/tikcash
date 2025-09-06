-- Add email verification support
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS evc_user_idx ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS evc_email_idx ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS evc_code_idx ON email_verification_codes(code);
