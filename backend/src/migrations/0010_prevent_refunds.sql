-- Prevent refunds: make completed tip transactions immutable (no status changes or deletions)
-- This trigger raises an error if someone attempts to update or delete a transaction
-- that is a tip and already has status = 'completed'.

-- Drop existing trigger/function if present (safe to run multiple times)
DROP TRIGGER IF EXISTS prevent_completed_tip_changes ON transactions;
DROP FUNCTION IF EXISTS fn_prevent_completed_tip_changes();

CREATE FUNCTION fn_prevent_completed_tip_changes()
  RETURNS trigger AS $$
BEGIN
  -- Only care about tip transactions
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    IF (TG_OP = 'UPDATE') THEN
      -- If the old row was a completed tip, disallow changing it to anything else
      IF (OLD.transaction_type = 'tip' AND OLD.status = 'completed') THEN
        -- If status is attempted to be changed or any other column altered, block it
        IF (NEW.status IS DISTINCT FROM OLD.status) OR (NEW.* IS DISTINCT FROM OLD.*) THEN
          RAISE EXCEPTION 'Completed tips are immutable and non-refundable';
        END IF;
      END IF;
    ELSIF (TG_OP = 'DELETE') THEN
      IF (OLD.transaction_type = 'tip' AND OLD.status = 'completed') THEN
        RAISE EXCEPTION 'Cannot delete completed tip transactions';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_completed_tip_changes
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_completed_tip_changes();

-- Note: This prevents accidental programmatic updates/deletes of completed tips.
-- Administrators needing to correct records should use a safe migration with
-- explicit approval (and ideally create reversing transactions instead of editing).
