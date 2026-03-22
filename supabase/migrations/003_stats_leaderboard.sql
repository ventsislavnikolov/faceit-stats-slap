-- Add K/R ratio to per-match player stats
ALTER TABLE match_player_stats ADD COLUMN kr_ratio NUMERIC(4,2) DEFAULT 0;

-- Compound index for "last N per player" queries used by stats leaderboard
CREATE INDEX idx_match_stats_player_played
  ON match_player_stats(faceit_player_id, played_at DESC);
