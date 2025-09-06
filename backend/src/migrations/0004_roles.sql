-- Add role to users: 'creator' or 'supporter' (default: supporter)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'supporter' CHECK (role IN ('creator','supporter'));

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Add role to users: 'creator' or 'supporter'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'supporter' CHECK (role IN ('creator','supporter'));
  END IF;
END$$;
