-- ============================================================
-- Fix: One-sided pools should resolve (not refund).
-- Winners get their bet back, losers lose their coins.
-- Also explicitly marks losing bets with payout = 0.
-- ============================================================

-- ── resolve_pool ─────────────────────────────────────────────
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

  -- One-sided pool: winners get bet back, losers lose coins
  IF v_losing_total = 0 OR v_winning_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id AND side = p_winning_team LOOP
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
      VALUES (v_bet.user_id, v_bet.amount, 'bet_won', v_bet.id);
    END LOOP;
    -- Mark losers explicitly
    UPDATE bets SET payout = 0 WHERE pool_id = v_pool.id AND side != p_winning_team;
    UPDATE betting_pools
    SET status = 'RESOLVED', winning_team = p_winning_team, resolved_at = now()
    WHERE id = v_pool.id;
    RETURN json_build_object('success', true, 'status', 'RESOLVED');
  END IF;

  -- Pay winners (pari-mutuel)
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

  -- Mark losers explicitly
  UPDATE bets SET payout = 0 WHERE pool_id = v_pool.id AND side != p_winning_team;

  UPDATE betting_pools
  SET status = 'RESOLVED', winning_team = p_winning_team, resolved_at = now()
  WHERE id = v_pool.id;
  RETURN json_build_object('success', true, 'status', 'RESOLVED');
END;
$$;

-- ── resolve_prop ─────────────────────────────────────────────
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

  -- One-sided pool: winners get bet back, losers lose coins
  IF v_losing_total = 0 OR v_winning_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id AND side = v_winning_side LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_bet.user_id::text));
      UPDATE season_participants
      SET coins = coins + v_bet.amount
      WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
      UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
      INSERT INTO coin_transactions (user_id, amount, reason, bet_id)
      VALUES (v_bet.user_id, v_bet.amount, 'bet_won', v_bet.id);
    END LOOP;
    -- Mark losers explicitly
    UPDATE bets SET payout = 0 WHERE prop_pool_id = v_prop.id AND side != v_winning_side;
    UPDATE prop_pools
    SET status = 'resolved', outcome = p_outcome, resolved_at = now()
    WHERE id = v_prop.id;
    RETURN json_build_object('success', true, 'status', 'resolved');
  END IF;

  -- Pay winners (pari-mutuel)
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

  -- Mark losers explicitly
  UPDATE bets SET payout = 0 WHERE prop_pool_id = v_prop.id AND side != v_winning_side;

  UPDATE prop_pools
  SET status = 'resolved', outcome = p_outcome, resolved_at = now()
  WHERE id = v_prop.id;
  RETURN json_build_object('success', true, 'status', 'resolved');
END;
$$;
