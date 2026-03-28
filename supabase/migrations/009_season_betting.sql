-- ============================================================
-- Seasons: time-bounded betting periods
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming', 'active', 'completed')),
  prizes      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seasons_dates_valid CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX seasons_single_active ON seasons (status) WHERE status = 'active';

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read seasons" ON seasons
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Season participants: per-user coin balance within a season
-- ============================================================
CREATE TABLE IF NOT EXISTS season_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  starting_coins  INTEGER NOT NULL DEFAULT 1000,
  coins           INTEGER NOT NULL DEFAULT 1000,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

ALTER TABLE season_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read season_participants" ON season_participants
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Prop pools: player-stat proposition bets within a match
-- ============================================================
CREATE TABLE IF NOT EXISTS prop_pools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id        UUID NOT NULL REFERENCES seasons(id),
  faceit_match_id  TEXT NOT NULL,
  player_id        TEXT NOT NULL,
  player_nickname  TEXT NOT NULL,
  stat_key         TEXT NOT NULL CHECK (stat_key IN ('kills', 'kd', 'adr')),
  threshold        NUMERIC NOT NULL,
  description      TEXT NOT NULL,
  yes_pool         INTEGER NOT NULL DEFAULT 0,
  no_pool          INTEGER NOT NULL DEFAULT 0,
  outcome          BOOLEAN,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'closed', 'resolved', 'refunded')),
  opens_at         TIMESTAMPTZ NOT NULL,
  closes_at        TIMESTAMPTZ NOT NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX prop_pools_match_player_stat ON prop_pools (faceit_match_id, player_id, stat_key);

ALTER TABLE prop_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read prop_pools" ON prop_pools
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Alter existing tables for season support
-- ============================================================
ALTER TABLE betting_pools ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

ALTER TABLE bets ADD COLUMN IF NOT EXISTS prop_pool_id UUID REFERENCES prop_pools(id);

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_amount_check;
ALTER TABLE bets ADD CONSTRAINT bets_amount_positive CHECK (amount >= 1);

ALTER TABLE bets ADD CONSTRAINT bets_pool_xor_prop CHECK (
  (pool_id IS NOT NULL AND prop_pool_id IS NULL) OR
  (pool_id IS NULL AND prop_pool_id IS NOT NULL)
);

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_pool_id_user_id_key;
CREATE UNIQUE INDEX bets_one_match_bet_per_user ON bets (pool_id, user_id) WHERE pool_id IS NOT NULL;

-- ============================================================
-- Enable Realtime for new tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prop_pools;
ALTER PUBLICATION supabase_realtime ADD TABLE season_participants;

-- ============================================================
-- Drop daily allowance (replaced by season starting coins)
-- ============================================================
DROP FUNCTION IF EXISTS claim_daily_allowance(UUID);

-- ============================================================
-- RPC: place_bet (season-aware, supports match + prop bets)
-- ============================================================
CREATE OR REPLACE FUNCTION place_bet(
  p_user_id      UUID,
  p_season_id    UUID,
  p_pool_id      UUID DEFAULT NULL,
  p_prop_pool_id UUID DEFAULT NULL,
  p_side         TEXT DEFAULT NULL,
  p_amount       INTEGER DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_season          seasons%ROWTYPE;
  v_pool            betting_pools%ROWTYPE;
  v_prop            prop_pools%ROWTYPE;
  v_participant     season_participants%ROWTYPE;
  v_coins           INTEGER;
  v_bet_id          UUID;
  v_bet_created_at  TIMESTAMPTZ;
  v_seconds_since_match_start INTEGER;
BEGIN
  -- Validate exactly one pool type
  IF (p_pool_id IS NOT NULL AND p_prop_pool_id IS NOT NULL)
     OR (p_pool_id IS NULL AND p_prop_pool_id IS NULL) THEN
    RETURN json_build_object('error', 'Provide exactly one of pool_id or prop_pool_id');
  END IF;

  -- Validate season is active
  SELECT * INTO v_season FROM seasons WHERE id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Season not found');
  END IF;
  IF v_season.status != 'active' THEN
    RETURN json_build_object('error', 'Season is not active');
  END IF;

  -- Auto-join season if not yet a participant
  INSERT INTO season_participants (season_id, user_id)
  VALUES (p_season_id, p_user_id)
  ON CONFLICT (season_id, user_id) DO NOTHING;

  -- Lock participant row and read balance
  SELECT * INTO v_participant
  FROM season_participants
  WHERE season_id = p_season_id AND user_id = p_user_id
  FOR UPDATE;

  v_coins := v_participant.coins;

  IF v_coins < p_amount THEN
    RETURN json_build_object('error', 'Not enough coins');
  END IF;

  -- ---- Match bet path ----
  IF p_pool_id IS NOT NULL THEN
    IF p_side NOT IN ('team1', 'team2') THEN
      RETURN json_build_object('error', 'Invalid side for match bet');
    END IF;

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

    -- Deduct coins
    UPDATE season_participants
    SET coins = coins - p_amount
    WHERE season_id = p_season_id AND user_id = p_user_id;

    INSERT INTO bets (pool_id, user_id, side, amount)
    VALUES (p_pool_id, p_user_id, p_side, p_amount)
    RETURNING id, created_at INTO v_bet_id, v_bet_created_at;

    IF p_side = 'team1' THEN
      UPDATE betting_pools SET team1_pool = team1_pool + p_amount WHERE id = p_pool_id;
    ELSE
      UPDATE betting_pools SET team2_pool = team2_pool + p_amount WHERE id = p_pool_id;
    END IF;

    -- Audit event
    IF v_pool.match_started_at IS NULL THEN
      v_seconds_since_match_start := NULL;
    ELSE
      v_seconds_since_match_start := GREATEST(
        floor(extract(epoch from (v_bet_created_at - v_pool.match_started_at)))::integer,
        0
      );
    END IF;

    INSERT INTO bet_audit_events (
      bet_id, pool_id, faceit_match_id, user_id, side, amount,
      bet_created_at, match_started_at, seconds_since_match_start,
      captured_pool_status
    ) VALUES (
      v_bet_id, v_pool.id, v_pool.faceit_match_id, p_user_id, p_side, p_amount,
      v_bet_created_at, v_pool.match_started_at, v_seconds_since_match_start,
      v_pool.status
    );

    INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
    VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id);

    RETURN json_build_object('success', true, 'bet_id', v_bet_id);
  END IF;

  -- ---- Prop bet path ----
  IF p_side NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid side for prop bet');
  END IF;

  SELECT * INTO v_prop FROM prop_pools WHERE id = p_prop_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Prop pool not found');
  END IF;
  IF v_prop.status != 'open' OR now() >= v_prop.closes_at THEN
    UPDATE prop_pools SET status = 'closed'
    WHERE id = p_prop_pool_id AND status = 'open' AND now() >= closes_at;
    RETURN json_build_object('error', 'Prop betting is closed');
  END IF;

  -- Deduct coins
  UPDATE season_participants
  SET coins = coins - p_amount
  WHERE season_id = p_season_id AND user_id = p_user_id;

  INSERT INTO bets (prop_pool_id, user_id, side, amount)
  VALUES (p_prop_pool_id, p_user_id, p_side, p_amount)
  RETURNING id INTO v_bet_id;

  IF p_side = 'yes' THEN
    UPDATE prop_pools SET yes_pool = yes_pool + p_amount WHERE id = p_prop_pool_id;
  ELSE
    UPDATE prop_pools SET no_pool = no_pool + p_amount WHERE id = p_prop_pool_id;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
  VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;

-- ============================================================
-- RPC: resolve_pool (credits season_participants.coins)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_pool(
  p_faceit_match_id TEXT,
  p_winning_team    TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool          betting_pools%ROWTYPE;
  v_bet           bets%ROWTYPE;
  v_winning_total INTEGER;
  v_losing_total  INTEGER;
  v_payout        INTEGER;
  v_season_id     UUID;
BEGIN
  SELECT * INTO v_pool
  FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pool not found');
  END IF;
  IF v_pool.status IN ('RESOLVED', 'REFUNDED') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  v_season_id := v_pool.season_id;

  IF p_winning_team = 'team1' THEN
    v_winning_total := v_pool.team1_pool;
    v_losing_total  := v_pool.team2_pool;
  ELSE
    v_winning_total := v_pool.team2_pool;
    v_losing_total  := v_pool.team1_pool;
  END IF;

  -- Refund path: one-sided pool
  IF v_losing_total = 0 OR v_winning_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
      IF v_season_id IS NOT NULL THEN
        UPDATE season_participants
        SET coins = coins + v_bet.amount
        WHERE season_id = v_season_id AND user_id = v_bet.user_id;
      ELSE
        UPDATE profiles SET coins = coins + v_bet.amount WHERE id = v_bet.user_id;
      END IF;
      UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
      INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
      VALUES (v_bet.user_id, v_bet.amount, 'bet_refunded', v_bet.id);
    END LOOP;
    UPDATE betting_pools
    SET status = 'REFUNDED', resolved_at = now()
    WHERE id = v_pool.id;
    RETURN json_build_object('success', true, 'status', 'REFUNDED');
  END IF;

  -- Pay winners
  FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id AND side = p_winning_team LOOP
    v_payout := floor(v_bet.amount::numeric / v_winning_total * v_losing_total)::integer
                + v_bet.amount;
    PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
    IF v_season_id IS NOT NULL THEN
      UPDATE season_participants
      SET coins = coins + v_payout
      WHERE season_id = v_season_id AND user_id = v_bet.user_id;
    ELSE
      UPDATE profiles SET coins = coins + v_payout WHERE id = v_bet.user_id;
    END IF;
    UPDATE bets SET payout = v_payout WHERE id = v_bet.id;
    INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
    VALUES (v_bet.user_id, v_payout, 'bet_won', v_bet.id);
  END LOOP;

  UPDATE betting_pools
  SET status = 'RESOLVED', winning_team = p_winning_team, resolved_at = now()
  WHERE id = v_pool.id;
  RETURN json_build_object('success', true, 'status', 'RESOLVED');
END;
$$;

-- ============================================================
-- RPC: resolve_prop (pari-mutuel payout on prop pools)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_prop(
  p_prop_pool_id UUID,
  p_outcome      BOOLEAN
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prop          prop_pools%ROWTYPE;
  v_bet           bets%ROWTYPE;
  v_winning_side  TEXT;
  v_winning_total INTEGER;
  v_losing_total  INTEGER;
  v_payout        INTEGER;
BEGIN
  SELECT * INTO v_prop FROM prop_pools WHERE id = p_prop_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Prop pool not found');
  END IF;
  IF v_prop.status IN ('resolved', 'refunded') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  v_winning_side := CASE WHEN p_outcome THEN 'yes' ELSE 'no' END;

  IF p_outcome THEN
    v_winning_total := v_prop.yes_pool;
    v_losing_total  := v_prop.no_pool;
  ELSE
    v_winning_total := v_prop.no_pool;
    v_losing_total  := v_prop.yes_pool;
  END IF;

  -- Refund path: one-sided pool
  IF v_losing_total = 0 OR v_winning_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
      UPDATE season_participants
      SET coins = coins + v_bet.amount
      WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
      UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
      INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
      VALUES (v_bet.user_id, v_bet.amount, 'bet_refunded', v_bet.id);
    END LOOP;
    UPDATE prop_pools
    SET status = 'refunded', outcome = p_outcome, resolved_at = now()
    WHERE id = v_prop.id;
    RETURN json_build_object('success', true, 'status', 'refunded');
  END IF;

  -- Pay winners
  FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id AND side = v_winning_side LOOP
    v_payout := floor(v_bet.amount::numeric / v_winning_total * v_losing_total)::integer
                + v_bet.amount;
    PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
    UPDATE season_participants
    SET coins = coins + v_payout
    WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
    UPDATE bets SET payout = v_payout WHERE id = v_bet.id;
    INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
    VALUES (v_bet.user_id, v_payout, 'bet_won', v_bet.id);
  END LOOP;

  UPDATE prop_pools
  SET status = 'resolved', outcome = p_outcome, resolved_at = now()
  WHERE id = v_prop.id;
  RETURN json_build_object('success', true, 'status', 'resolved');
END;
$$;

-- ============================================================
-- RPC: cancel_pool (refunds to season_participants.coins)
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_pool(
  p_faceit_match_id TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool      betting_pools%ROWTYPE;
  v_bet       bets%ROWTYPE;
  v_season_id UUID;
BEGIN
  SELECT * INTO v_pool
  FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;
  IF v_pool.status IN ('RESOLVED', 'REFUNDED') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  v_season_id := v_pool.season_id;

  FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
    IF v_season_id IS NOT NULL THEN
      UPDATE season_participants
      SET coins = coins + v_bet.amount
      WHERE season_id = v_season_id AND user_id = v_bet.user_id;
    ELSE
      UPDATE profiles SET coins = coins + v_bet.amount WHERE id = v_bet.user_id;
    END IF;
    UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
    INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
    VALUES (v_bet.user_id, v_bet.amount, 'bet_refunded', v_bet.id);
  END LOOP;

  UPDATE betting_pools
  SET status = 'REFUNDED', resolved_at = now()
  WHERE id = v_pool.id;
  RETURN json_build_object('success', true, 'status', 'REFUNDED');
END;
$$;

-- ============================================================
-- RPC: cancel_prop (refunds all bettors on a prop pool)
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_prop(
  p_prop_pool_id UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prop prop_pools%ROWTYPE;
  v_bet  bets%ROWTYPE;
BEGIN
  SELECT * INTO v_prop FROM prop_pools WHERE id = p_prop_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;
  IF v_prop.status IN ('resolved', 'refunded') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
    UPDATE season_participants
    SET coins = coins + v_bet.amount
    WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
    UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
    INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
    VALUES (v_bet.user_id, v_bet.amount, 'bet_refunded', v_bet.id);
  END LOOP;

  UPDATE prop_pools
  SET status = 'refunded', resolved_at = now()
  WHERE id = v_prop.id;
  RETURN json_build_object('success', true, 'status', 'refunded');
END;
$$;
