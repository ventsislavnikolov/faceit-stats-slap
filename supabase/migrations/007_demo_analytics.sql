CREATE TABLE demo_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT NOT NULL REFERENCES matches(faceit_match_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('faceit_demo_url', 'manual_upload')),
  source_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  file_sha256 TEXT,
  compression TEXT NOT NULL DEFAULT 'dem' CHECK (compression IN ('dem', 'zst')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'parsing', 'parsed', 'failed', 'source_unavailable')
  ),
  parser_version TEXT,
  demo_patch_version TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id, faceit_match_id)
);

ALTER TABLE demo_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo_ingestions"
  ON demo_ingestions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_demo_ingestions_status
  ON demo_ingestions(status);

CREATE INDEX idx_demo_ingestions_match_id
  ON demo_ingestions(faceit_match_id);

CREATE UNIQUE INDEX ux_demo_ingestions_active_source_url
  ON demo_ingestions(faceit_match_id, source_type, source_url)
  WHERE source_url IS NOT NULL
    AND status IN ('queued', 'parsing');

CREATE UNIQUE INDEX ux_demo_ingestions_active_file_sha256
  ON demo_ingestions(faceit_match_id, source_type, file_sha256)
  WHERE file_sha256 IS NOT NULL
    AND status IN ('queued', 'parsing');

CREATE TABLE demo_match_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_id UUID NOT NULL REFERENCES demo_ingestions(id) ON DELETE CASCADE,
  faceit_match_id TEXT NOT NULL,
  map_name TEXT,
  server_name TEXT,
  demo_source_type TEXT NOT NULL CHECK (demo_source_type IN ('faceit_demo_url', 'manual_upload')),
  total_rounds INTEGER NOT NULL DEFAULT 0,
  winner_team_key TEXT CHECK (winner_team_key IN ('team1', 'team2')),
  team1_name TEXT NOT NULL,
  team2_name TEXT NOT NULL,
  team1_score INTEGER NOT NULL DEFAULT 0,
  team2_score INTEGER NOT NULL DEFAULT 0,
  team1_first_half_side TEXT NOT NULL DEFAULT 'unknown' CHECK (team1_first_half_side IN ('CT', 'T', 'unknown')),
  team2_first_half_side TEXT NOT NULL DEFAULT 'unknown' CHECK (team2_first_half_side IN ('CT', 'T', 'unknown')),
  longest_team1_win_streak INTEGER NOT NULL DEFAULT 0,
  longest_team2_win_streak INTEGER NOT NULL DEFAULT 0,
  ingestion_status TEXT NOT NULL DEFAULT 'queued' CHECK (
    ingestion_status IN ('queued', 'parsing', 'parsed', 'failed', 'source_unavailable')
  ),
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(faceit_match_id),
  UNIQUE(ingestion_id),
  UNIQUE(id, faceit_match_id),
  FOREIGN KEY (ingestion_id, faceit_match_id)
    REFERENCES demo_ingestions(id, faceit_match_id)
    ON DELETE CASCADE
);

ALTER TABLE demo_match_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo_match_analytics"
  ON demo_match_analytics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_demo_match_analytics_match_id
  ON demo_match_analytics(faceit_match_id);

CREATE INDEX idx_demo_match_analytics_ingestion_status
  ON demo_match_analytics(ingestion_status);

CREATE TABLE demo_team_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_match_id UUID NOT NULL,
  faceit_match_id TEXT NOT NULL,
  team_key TEXT NOT NULL CHECK (team_key IN ('team1', 'team2')),
  name TEXT NOT NULL,
  first_half_side TEXT NOT NULL DEFAULT 'unknown' CHECK (first_half_side IN ('CT', 'T', 'unknown')),
  trade_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  opening_duel_win_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  rounds_won INTEGER NOT NULL DEFAULT 0,
  rounds_lost INTEGER NOT NULL DEFAULT 0,
  longest_win_streak INTEGER NOT NULL DEFAULT 0,
  longest_loss_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(faceit_match_id, team_key),
  FOREIGN KEY (demo_match_id, faceit_match_id)
    REFERENCES demo_match_analytics(id, faceit_match_id)
    ON DELETE CASCADE
);

ALTER TABLE demo_team_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo_team_analytics"
  ON demo_team_analytics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_demo_team_analytics_match_id
  ON demo_team_analytics(faceit_match_id);

CREATE TABLE demo_player_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_match_id UUID NOT NULL,
  faceit_match_id TEXT NOT NULL,
  faceit_player_id TEXT,
  steam_id TEXT,
  nickname TEXT NOT NULL,
  team_key TEXT NOT NULL CHECK (team_key IN ('team1', 'team2')),
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  adr_demo NUMERIC(5,2) NOT NULL DEFAULT 0,
  hs_percent_demo NUMERIC(5,2) NOT NULL DEFAULT 0,
  rating_demo NUMERIC(5,2),
  entry_kills INTEGER NOT NULL DEFAULT 0,
  entry_deaths INTEGER NOT NULL DEFAULT 0,
  opening_duel_attempts INTEGER NOT NULL DEFAULT 0,
  opening_duel_wins INTEGER NOT NULL DEFAULT 0,
  trade_kills INTEGER NOT NULL DEFAULT 0,
  traded_deaths INTEGER NOT NULL DEFAULT 0,
  untraded_deaths INTEGER NOT NULL DEFAULT 0,
  exit_kills INTEGER NOT NULL DEFAULT 0,
  clutch_attempts INTEGER NOT NULL DEFAULT 0,
  clutch_wins INTEGER NOT NULL DEFAULT 0,
  last_alive_rounds INTEGER NOT NULL DEFAULT 0,
  bomb_plants INTEGER NOT NULL DEFAULT 0,
  bomb_defuses INTEGER NOT NULL DEFAULT 0,
  utility_damage_demo INTEGER NOT NULL DEFAULT 0,
  flash_assists_demo INTEGER NOT NULL DEFAULT 0,
  rws NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (faceit_player_id IS NOT NULL OR steam_id IS NOT NULL),
  FOREIGN KEY (demo_match_id, faceit_match_id)
    REFERENCES demo_match_analytics(id, faceit_match_id)
    ON DELETE CASCADE
);

ALTER TABLE demo_player_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo_player_analytics"
  ON demo_player_analytics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_demo_player_analytics_match_id
  ON demo_player_analytics(faceit_match_id);

CREATE INDEX idx_demo_player_analytics_faceit_player_id
  ON demo_player_analytics(faceit_player_id)
  WHERE faceit_player_id IS NOT NULL;

CREATE UNIQUE INDEX ux_demo_player_analytics_match_faceit_player_id
  ON demo_player_analytics(faceit_match_id, faceit_player_id)
  WHERE faceit_player_id IS NOT NULL;

CREATE UNIQUE INDEX ux_demo_player_analytics_match_steam_id
  ON demo_player_analytics(faceit_match_id, steam_id)
  WHERE steam_id IS NOT NULL;

CREATE TABLE demo_round_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_match_id UUID NOT NULL,
  faceit_match_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  winner_team_key TEXT CHECK (winner_team_key IN ('team1', 'team2')),
  score_team1 INTEGER NOT NULL DEFAULT 0,
  score_team2 INTEGER NOT NULL DEFAULT 0,
  t_team_key TEXT NOT NULL CHECK (t_team_key IN ('team1', 'team2')),
  ct_team_key TEXT NOT NULL CHECK (ct_team_key IN ('team1', 'team2')),
  t_buy_type TEXT NOT NULL DEFAULT 'unknown',
  ct_buy_type TEXT NOT NULL DEFAULT 'unknown',
  is_pistol BOOLEAN NOT NULL DEFAULT false,
  end_reason TEXT,
  bomb_planted BOOLEAN NOT NULL DEFAULT false,
  bomb_defused BOOLEAN NOT NULL DEFAULT false,
  planter_steam_id TEXT,
  defuser_steam_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(faceit_match_id, round_number),
  FOREIGN KEY (demo_match_id, faceit_match_id)
    REFERENCES demo_match_analytics(id, faceit_match_id)
    ON DELETE CASCADE
);

ALTER TABLE demo_round_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo_round_analytics"
  ON demo_round_analytics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_demo_round_analytics_match_id
  ON demo_round_analytics(faceit_match_id);
