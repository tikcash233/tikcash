-- Recovery PIN support: hashed PIN + attempts + lockout window
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_pin_locked_idx ON users(pin_locked_until);
