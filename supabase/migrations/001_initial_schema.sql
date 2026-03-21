-- App user profiles (links to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- FACEIT friends being tracked
CREATE TABLE tracked_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_id TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  elo INTEGER,
  skill_level INTEGER,
  win_rate NUMERIC(5,2),
  lifetime_kd NUMERIC(4,2),
  lifetime_hs INTEGER,
  lifetime_adr NUMERIC(5,1),
  total_matches INTEGER,
  twitch_channel TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tracked_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tracked_friends" ON tracked_friends
  FOR SELECT USING (auth.role() = 'authenticated');

-- Matches (live and historical)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONGOING',
  map TEXT,
  score TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  team_roster JSONB,
  opponent_roster JSONB,
  match_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read matches" ON matches
  FOR SELECT USING (auth.role() = 'authenticated');

-- Per-player stats for each match
CREATE TABLE match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  faceit_player_id TEXT NOT NULL,
  nickname TEXT,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  headshots INTEGER DEFAULT 0,
  mvps INTEGER DEFAULT 0,
  kd_ratio NUMERIC(4,2),
  adr NUMERIC(5,1),
  hs_percent INTEGER,
  clutches INTEGER DEFAULT 0,
  triple_kills INTEGER DEFAULT 0,
  quadro_kills INTEGER DEFAULT 0,
  penta_kills INTEGER DEFAULT 0,
  elo_before INTEGER,
  elo_after INTEGER,
  elo_delta INTEGER,
  win BOOLEAN,
  map TEXT,
  played_at TIMESTAMPTZ,
  UNIQUE(match_id, faceit_player_id)
);

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read match_player_stats" ON match_player_stats
  FOR SELECT USING (auth.role() = 'authenticated');

-- Indexes for common queries
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_faceit_id ON matches(faceit_match_id);
CREATE INDEX idx_match_stats_player ON match_player_stats(faceit_player_id);
CREATE INDEX idx_match_stats_match ON match_player_stats(match_id);
CREATE INDEX idx_tracked_friends_faceit ON tracked_friends(faceit_id);
