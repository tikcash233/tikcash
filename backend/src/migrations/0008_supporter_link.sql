-- Add supporter_user_id to link transactions to authenticated users
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS supporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS transactions_supporter_user_idx ON transactions(supporter_user_id);

-- Update existing transactions to include supporter_user_id where possible
-- This would be done manually in production with proper data migration logic