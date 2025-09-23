-- Add approved_by and approved_at to transactions so we can track which admin approved a withdrawal
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS approved_by UUID NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE NULL;

-- Optional FK to users table (nullable) to keep referential integrity when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'transactions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'approved_by'
  ) THEN
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;
