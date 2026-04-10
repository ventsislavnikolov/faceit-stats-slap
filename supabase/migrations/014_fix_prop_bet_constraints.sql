-- ============================================================
-- Fix constraints on bets table to support prop bets
-- ============================================================
-- Migration 002 created the bets table with:
--   pool_id NOT NULL
--   side CHECK (side IN ('team1', 'team2'))
-- Migration 009 added prop_pool_id with an XOR constraint
-- (pool_id OR prop_pool_id must be set), but never relaxed
-- the original NOT NULL / side constraints. Prop bets need
-- pool_id = NULL and side IN ('yes', 'no').
-- ============================================================

-- Allow pool_id to be NULL (the XOR constraint from 009 ensures
-- exactly one of pool_id / prop_pool_id is set).
ALTER TABLE bets ALTER COLUMN pool_id DROP NOT NULL;

-- Expand the side check to include prop-bet sides.
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_side_check;
ALTER TABLE bets ADD CONSTRAINT bets_side_check
  CHECK (side IN ('team1', 'team2', 'yes', 'no'));
