CREATE TABLE faceit_webhook_live_state (
  player_faceit_id TEXT PRIMARY KEY,
  player_nickname TEXT NOT NULL,
  current_match_id TEXT,
  match_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  source_event TEXT NOT NULL,
  payload JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_faceit_webhook_live_state_match_id
  ON faceit_webhook_live_state(current_match_id);

ALTER TABLE faceit_webhook_live_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read faceit_webhook_live_state"
  ON faceit_webhook_live_state
  FOR SELECT
  USING (auth.role() = 'authenticated');
