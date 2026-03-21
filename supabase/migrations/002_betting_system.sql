-- ============================================================
-- Profiles: add coins and daily allowance tracking
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_daily_at TIMESTAMPTZ;

-- ============================================================
-- Betting pools: one per match
-- ============================================================
CREATE TABLE IF NOT EXISTS betting_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN', 'CLOSED', 'RESOLVED', 'REFUNDED')),
  team1_name      TEXT NOT NULL,
  team2_name      TEXT NOT NULL,
  team1_pool      INTEGER NOT NULL DEFAULT 0,
  team2_pool      INTEGER NOT NULL DEFAULT 0,
  winning_team    TEXT CHECK (winning_team IN ('team1', 'team2')),
  opens_at        TIMESTAMPTZ NOT NULL,
  closes_at       TIMESTAMPTZ NOT NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_betting_pools_status ON betting_pools(status);

ALTER TABLE betting_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read betting_pools" ON betting_pools
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Bets: one per user per pool
-- ============================================================
CREATE TABLE IF NOT EXISTS bets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id    UUID NOT NULL REFERENCES betting_pools(id),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  side       TEXT NOT NULL CHECK (side IN ('team1', 'team2')),
  amount     INTEGER NOT NULL CHECK (amount >= 10 AND amount <= 500),
  payout     INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bets_pool_id ON bets(pool_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read bets" ON bets
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Coin transactions: append-only audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL
             CHECK (reason IN ('bet_placed','bet_won','bet_refunded','daily_allowance')),
  bet_id     UUID REFERENCES bets(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own transactions" ON coin_transactions
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- RPC: place_bet
-- ============================================================
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
  RETURNING id INTO v_bet_id;

  IF p_side = 'team1' THEN
    UPDATE betting_pools SET team1_pool = team1_pool + p_amount WHERE id = p_pool_id;
  ELSE
    UPDATE betting_pools SET team2_pool = team2_pool + p_amount WHERE id = p_pool_id;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
  VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;

-- ============================================================
-- RPC: resolve_pool
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
BEGIN
  SELECT * INTO v_pool
  FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pool not found');
  END IF;
  IF v_pool.status IN ('RESOLVED', 'REFUNDED') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

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
      UPDATE profiles SET coins = coins + v_bet.amount WHERE id = v_bet.user_id;
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
    UPDATE profiles SET coins = coins + v_payout WHERE id = v_bet.user_id;
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
-- RPC: cancel_pool
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_pool(
  p_faceit_match_id TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool betting_pools%ROWTYPE;
  v_bet  bets%ROWTYPE;
BEGIN
  SELECT * INTO v_pool
  FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;
  IF v_pool.status IN ('RESOLVED', 'REFUNDED') THEN
    RETURN json_build_object('success', true, 'skipped', true);
  END IF;

  FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
    UPDATE profiles SET coins = coins + v_bet.amount WHERE id = v_bet.user_id;
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
-- RPC: claim_daily_allowance
-- ============================================================
CREATE OR REPLACE FUNCTION claim_daily_allowance(
  p_user_id UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_daily TIMESTAMPTZ;
  v_new_coins  INTEGER;
BEGIN
  SELECT last_daily_at INTO v_last_daily
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_last_daily IS NOT NULL
     AND v_last_daily::date >= (now() AT TIME ZONE 'UTC')::date THEN
    SELECT coins INTO v_new_coins FROM profiles WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'skipped', true, 'coins', v_new_coins);
  END IF;

  UPDATE profiles
  SET coins = coins + 50, last_daily_at = now()
  WHERE id = p_user_id
  RETURNING coins INTO v_new_coins;

  INSERT INTO coin_transactions (user_id, amount, reason)
  VALUES (p_user_id, 50, 'daily_allowance');

  RETURN json_build_object('success', true, 'coins', v_new_coins);
END;
$$;
