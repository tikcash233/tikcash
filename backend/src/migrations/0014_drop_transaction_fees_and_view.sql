-- Reversible migration to drop the audit table and view if you want to remove the feature.
-- NOTE: This file only prepares the drop; do NOT run it until you're sure you want to remove historical audit data.

BEGIN;

DROP VIEW IF EXISTS vw_transaction_net;

DROP TABLE IF EXISTS transaction_fees;

-- Optionally record this migration when run by your migration runner
COMMIT;
