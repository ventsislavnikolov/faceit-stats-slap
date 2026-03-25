ALTER TABLE betting_pools
ADD COLUMN IF NOT EXISTS match_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS bet_audit_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id                   UUID NOT NULL UNIQUE REFERENCES bets(id) ON DELETE CASCADE,
  pool_id                  UUID NOT NULL REFERENCES betting_pools(id) ON DELETE CASCADE,
  faceit_match_id          TEXT NOT NULL,
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side                     TEXT NOT NULL CHECK (side IN ('team1', 'team2')),
  amount                   INTEGER NOT NULL CHECK (amount >= 10 AND amount <= 500),
  bet_created_at           TIMESTAMPTZ NOT NULL,
  match_started_at         TIMESTAMPTZ,
  seconds_since_match_start INTEGER,
  captured_pool_status     TEXT NOT NULL
                           CHECK (captured_pool_status IN ('OPEN', 'CLOSED', 'RESOLVED', 'REFUNDED')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bet_audit_events_match_id
  ON bet_audit_events(faceit_match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_audit_events_user_id
  ON bet_audit_events(user_id, created_at DESC);

ALTER TABLE bet_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION place_bet(
  p_user_id UUID,
  p_pool_id UUID,
  p_side    TEXT,
  p_amount  INTEGER
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool   betting_pools%ROWTYPE;
  v_coins  INTEGER;
  v_bet_id UUID;
  v_bet_created_at TIMESTAMPTZ;
  v_seconds_since_match_start INTEGER;
BEGIN
  SELECT * INTO v_pool FROM betting_pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pool not found');
  END IF;
  IF v_pool.status != 'OPEN' OR now() >= v_pool.closes_at THEN
    UPDATE betting_pools SET status = 'CLOSED'
    WHERE id = p_pool_id AND status = 'OPEN' AND now() >= closes_at;
    RETURN json_build_object('error', 'Betting is closed');
  END IF;

  IF EXISTS (SELECT 1 FROM bets WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'Already placed a bet on this match');
  END IF;

  SELECT coins INTO v_coins FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_coins IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;
  IF v_coins < p_amount THEN
    RETURN json_build_object('error', 'Not enough coins');
  END IF;

  UPDATE profiles SET coins = coins - p_amount WHERE id = p_user_id;

  INSERT INTO bets (pool_id, user_id, side, amount)
  VALUES (p_pool_id, p_user_id, p_side, p_amount)
  RETURNING id, created_at INTO v_bet_id, v_bet_created_at;

  IF p_side = 'team1' THEN
    UPDATE betting_pools SET team1_pool = team1_pool + p_amount WHERE id = p_pool_id;
  ELSE
    UPDATE betting_pools SET team2_pool = team2_pool + p_amount WHERE id = p_pool_id;
  END IF;

  IF v_pool.match_started_at IS NULL THEN
    v_seconds_since_match_start := NULL;
  ELSE
    v_seconds_since_match_start := GREATEST(
      floor(extract(epoch from (v_bet_created_at - v_pool.match_started_at)))::integer,
      0
    );
  END IF;

  INSERT INTO bet_audit_events (
    bet_id,
    pool_id,
    faceit_match_id,
    user_id,
    side,
    amount,
    bet_created_at,
    match_started_at,
    seconds_since_match_start,
    captured_pool_status
  ) VALUES (
    v_bet_id,
    v_pool.id,
    v_pool.faceit_match_id,
    p_user_id,
    p_side,
    p_amount,
    v_bet_created_at,
    v_pool.match_started_at,
    v_seconds_since_match_start,
    v_pool.status
  );

  INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
  VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;
