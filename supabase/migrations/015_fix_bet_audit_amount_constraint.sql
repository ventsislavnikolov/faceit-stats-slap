-- Migration 009 removed the 500-coin cap from the bets table but
-- bet_audit_events still had CHECK (amount >= 10 AND amount <= 500).
-- Any bet over 500 coins would pass the bets insert then blow up on
-- the audit log insert inside place_bet, leaving coins deducted but
-- no bet recorded. Align the constraint with the current bets table.

ALTER TABLE bet_audit_events
  DROP CONSTRAINT IF EXISTS bet_audit_events_amount_check;

ALTER TABLE bet_audit_events
  ADD CONSTRAINT bet_audit_events_amount_check CHECK (amount >= 1);
