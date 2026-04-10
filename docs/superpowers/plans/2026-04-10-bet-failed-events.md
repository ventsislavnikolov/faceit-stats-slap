# Bet Failed Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log failed `place_bet` attempts to a new `bet_failed_events` table for debugging.

**Architecture:** Single migration file (`013_bet_failed_events.sql`) — creates the table and replaces `place_bet` with an updated version that inserts a row into `bet_failed_events` before each error return. No app-layer changes.

**Tech Stack:** PostgreSQL / plpgsql, Supabase migrations

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/013_bet_failed_events.sql` |

---

### Task 1: Create and apply migration

**Files:**
- Create: `supabase/migrations/013_bet_failed_events.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/013_bet_failed_events.sql` with the following content:

```sql
-- ============================================================
-- Add bet_failed_events table.
-- Update place_bet to log all failed attempts.
-- ============================================================

CREATE TABLE IF NOT EXISTS bet_failed_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id                   UUID REFERENCES betting_pools(id) ON DELETE SET NULL,
  faceit_match_id           TEXT,
  side                      TEXT,
  amount                    INTEGER,
  error_reason              TEXT NOT NULL,
  pool_status               TEXT,
  pool_closes_at            TIMESTAMPTZ,
  match_started_at          TIMESTAMPTZ,
  seconds_since_match_start INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bet_failed_events_user_id
  ON bet_failed_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_failed_events_match_id
  ON bet_failed_events(faceit_match_id, created_at DESC);

-- ── place_bet (updated: logs failures to bet_failed_events) ──
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
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Provide exactly one of pool_id or prop_pool_id');
    RETURN json_build_object('error', 'Provide exactly one of pool_id or prop_pool_id');
  END IF;

  -- Validate season is active
  SELECT * INTO v_season FROM seasons WHERE id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Season not found');
    RETURN json_build_object('error', 'Season not found');
  END IF;
  IF v_season.status != 'active' THEN
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Season is not active');
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
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Not enough coins');
    RETURN json_build_object('error', 'Not enough coins');
  END IF;

  -- ── Match bet path ────────────────────────────────────────
  IF p_pool_id IS NOT NULL THEN
    IF p_side NOT IN ('team1', 'team2') THEN
      INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
      VALUES (p_user_id, p_side, p_amount, 'Invalid side for match bet');
      RETURN json_build_object('error', 'Invalid side for match bet');
    END IF;

    SELECT * INTO v_pool FROM betting_pools WHERE id = p_pool_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
      VALUES (p_user_id, p_side, p_amount, 'Pool not found');
      RETURN json_build_object('error', 'Pool not found');
    END IF;

    IF v_pool.status != 'OPEN' OR now() >= v_pool.closes_at THEN
      UPDATE betting_pools SET status = 'CLOSED'
      WHERE id = p_pool_id AND status = 'OPEN' AND now() >= closes_at;
      INSERT INTO bet_failed_events (
        user_id, pool_id, faceit_match_id, side, amount, error_reason,
        pool_status, pool_closes_at, match_started_at, seconds_since_match_start
      ) VALUES (
        p_user_id, v_pool.id, v_pool.faceit_match_id, p_side, p_amount,
        'Betting is closed',
        v_pool.status, v_pool.closes_at, v_pool.match_started_at,
        CASE WHEN v_pool.match_started_at IS NULL THEN NULL
             ELSE GREATEST(floor(extract(epoch from (now() - v_pool.match_started_at)))::integer, 0)
        END
      );
      RETURN json_build_object('error', 'Betting is closed');
    END IF;

    IF EXISTS (SELECT 1 FROM bets WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
      INSERT INTO bet_failed_events (
        user_id, pool_id, faceit_match_id, side, amount, error_reason,
        pool_status, pool_closes_at, match_started_at, seconds_since_match_start
      ) VALUES (
        p_user_id, v_pool.id, v_pool.faceit_match_id, p_side, p_amount,
        'Already placed a bet on this match',
        v_pool.status, v_pool.closes_at, v_pool.match_started_at,
        CASE WHEN v_pool.match_started_at IS NULL THEN NULL
             ELSE GREATEST(floor(extract(epoch from (now() - v_pool.match_started_at)))::integer, 0)
        END
      );
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

  -- ── Prop bet path ─────────────────────────────────────────
  IF p_side NOT IN ('yes', 'no') THEN
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Invalid side for prop bet');
    RETURN json_build_object('error', 'Invalid side for prop bet');
  END IF;

  SELECT * INTO v_prop FROM prop_pools WHERE id = p_prop_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO bet_failed_events (user_id, side, amount, error_reason)
    VALUES (p_user_id, p_side, p_amount, 'Prop pool not found');
    RETURN json_build_object('error', 'Prop pool not found');
  END IF;

  IF v_prop.status != 'open' OR now() >= v_prop.closes_at THEN
    UPDATE prop_pools SET status = 'closed'
    WHERE id = p_prop_pool_id AND status = 'open' AND now() >= closes_at;
    INSERT INTO bet_failed_events (
      user_id, side, amount, error_reason,
      pool_closes_at, match_started_at
    ) VALUES (
      p_user_id, p_side, p_amount, 'Prop betting is closed',
      v_prop.closes_at, NULL
    );
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
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with:
- `project_id`: `dnluljisefcrorrtuxgq`
- `name`: `bet_failed_events`
- `query`: the full SQL above

- [ ] **Step 3: Verify the table was created**

Run via `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bet_failed_events'
ORDER BY ordinal_position;
```

Expected: 12 rows listing all columns (id, user_id, pool_id, faceit_match_id, side, amount, error_reason, pool_status, pool_closes_at, match_started_at, seconds_since_match_start, created_at).

- [ ] **Step 4: Verify migration appears in history**

Run via `list_migrations`. Expected: `bet_failed_events` appears as the last entry.

- [ ] **Step 5: Smoke-test by querying for existing failures**

Run via `execute_sql`:

```sql
SELECT COUNT(*) FROM bet_failed_events;
```

Expected: `0` (no historical failures captured — logging starts from now).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/013_bet_failed_events.sql
git commit -m "feat: log failed place_bet attempts to bet_failed_events"
```

---

## Querying failures (reference)

To debug a future incident, run in Supabase dashboard:

```sql
-- All failures for a specific user
SELECT p.nickname, bfe.*
FROM bet_failed_events bfe
JOIN profiles p ON bfe.user_id = p.id
WHERE p.nickname = 'some_user'
ORDER BY bfe.created_at DESC;

-- All failures on a specific match
SELECT p.nickname, bfe.side, bfe.amount, bfe.error_reason,
       bfe.pool_status, bfe.pool_closes_at, bfe.seconds_since_match_start, bfe.created_at
FROM bet_failed_events bfe
JOIN profiles p ON bfe.user_id = p.id
WHERE bfe.faceit_match_id = '<match_id>'
ORDER BY bfe.created_at;
```
