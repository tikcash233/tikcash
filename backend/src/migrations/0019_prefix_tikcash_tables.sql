-- Prefix core TikCash tables with 'tikcash_' to avoid name collisions when sharing a database.
DO $$
BEGIN
  -- creators -> tikcash_creators
  IF to_regclass('public.tikcash_creators') IS NULL AND to_regclass('public.creators') IS NOT NULL THEN
    ALTER TABLE creators RENAME TO tikcash_creators;
  END IF;

  -- transactions -> tikcash_transactions
  IF to_regclass('public.tikcash_transactions') IS NULL AND to_regclass('public.transactions') IS NOT NULL THEN
    ALTER TABLE transactions RENAME TO tikcash_transactions;
  END IF;

  -- users -> tikcash_users
  IF to_regclass('public.tikcash_users') IS NULL AND to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE users RENAME TO tikcash_users;
  END IF;

  -- email_verification_codes -> tikcash_email_verification_codes
  IF to_regclass('public.tikcash_email_verification_codes') IS NULL AND to_regclass('public.email_verification_codes') IS NOT NULL THEN
    ALTER TABLE email_verification_codes RENAME TO tikcash_email_verification_codes;
  END IF;

  -- transaction_fees -> tikcash_transaction_fees
  IF to_regclass('public.tikcash_transaction_fees') IS NULL AND to_regclass('public.transaction_fees') IS NOT NULL THEN
    ALTER TABLE transaction_fees RENAME TO tikcash_transaction_fees;
  END IF;

  -- vw_transaction_net -> tikcash_vw_transaction_net
  IF to_regclass('public.tikcash_vw_transaction_net') IS NULL AND to_regclass('public.vw_transaction_net') IS NOT NULL THEN
    ALTER VIEW vw_transaction_net RENAME TO tikcash_vw_transaction_net;
  END IF;

  -- support_tickets -> tikcash_support_tickets
  IF to_regclass('public.tikcash_support_tickets') IS NULL AND to_regclass('public.support_tickets') IS NOT NULL THEN
    ALTER TABLE support_tickets RENAME TO tikcash_support_tickets;
  END IF;
END
$$;
