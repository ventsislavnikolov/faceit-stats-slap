# Season-Based Betting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing pari-mutuel match betting system with a season-based competitive leaderboard featuring match outcome bets + auto-generated player performance props.

**Architecture:** New `seasons`, `season_participants`, and `prop_pools` tables added via Supabase migration. Existing `betting_pools` and `bets` tables extended with season/prop FKs. Server functions rewritten to operate on season-scoped data. UI rebuilt as a tabbed season hub on `/bets`.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router/Query, Supabase (Postgres + Realtime), Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-season-betting-redesign.md`

---

## File Structure

### New Files
- `supabase/migrations/009_season_betting.sql` — new tables, altered tables, new RPCs
- `src/lib/seasons.ts` — season utilities (status checks, admin gate, prop generation logic)
- `src/lib/prop-generation.ts` — threshold calculation from player averages
- `src/hooks/useActiveSeason.ts` — query hook for active/upcoming season
- `src/hooks/useSeasonLeaderboard.ts` — query hook for season leaderboard
- `src/hooks/useSeasonCoinBalance.ts` — query hook for season-scoped coin balance
- `src/hooks/usePropPools.ts` — query hook for match prop pools
- `src/components/SeasonHeader.tsx` — season name, dates, status badge, coin balance
- `src/components/SeasonLeaderboardTab.tsx` — season leaderboard table + prizes
- `src/components/LiveBetsTab.tsx` — live match bet cards + prop cards
- `src/components/BetCard.tsx` — self-contained bet card (match outcome or prop)
- `src/components/SeasonMyBetsTab.tsx` — personal bet history for current season
- `src/components/SeasonHistoryTab.tsx` — past season archive browser
- `src/components/CreateSeasonForm.tsx` — admin-only season creation form
- `src/server/seasons.ts` — season CRUD server functions
- `tests/lib/seasons.test.ts` — season utility tests
- `tests/lib/prop-generation.test.ts` — prop threshold tests
- `tests/server/seasons.test.ts` — season server function tests
- `tests/components/bet-card.test.tsx` — BetCard component tests

### Modified Files
- `src/lib/types.ts` — add Season, SeasonParticipant, PropPool, PropBetSide types
- `src/lib/betting.ts` — add `calculateMultiplier` helper, update `isBettingOpen` for props
- `src/server/betting.ts` — rewrite `placeBet`, `getLeaderboard`, `getCoinBalance`; remove `claimDailyAllowance`
- `src/server/matches.ts` — extend pool creation to generate prop_pools; extend resolution to resolve props
- `src/hooks/useBettingPool.ts` — add Realtime subscription for prop_pools
- `src/hooks/useCoinBalance.ts` — read from season_participants instead of profiles
- `src/components/CoinBalance.tsx` — use season-scoped balance
- `src/components/BettingPanel.tsx` — rewrite to render BetCard components for match + props
- `src/components/BetsLeaderboardTab.tsx` — replace with SeasonLeaderboardTab
- `src/components/BetHistoryTab.tsx` — replace with SeasonMyBetsTab
- `src/routes/_authed/bets.tsx` — rebuild as season hub with 4 tabs
- `src/routes/_authed.tsx` — update CoinBalance props
- `src/lib/constants.ts` — add ADMIN_USER_ID constant

### Removed Code (during modifications)
- `claimDailyAllowance` server function and RPC
- Auto-claim in `useCoinBalance` hook
- `coin_transactions` writes in RPCs
- `bet_audit_events` writes in RPCs
- Fixed 10-coin bet amount references

---

## Task 1: Database Migration — New Tables

**Files:**
- Create: `supabase/migrations/009_season_betting.sql`

- [ ] **Step 1: Write the seasons table**

```sql
-- ============================================================
-- 009 — Season-based betting system
-- ============================================================

-- Seasons
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

-- Only one active season at a time
CREATE UNIQUE INDEX seasons_single_active
  ON seasons (status) WHERE status = 'active';

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read seasons"
  ON seasons FOR SELECT USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Write the season_participants table**

Add to the same migration file:

```sql
-- Season participants (per-season coin balances)
CREATE TABLE IF NOT EXISTS season_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   UUID NOT NULL REFERENCES seasons(id),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  starting_coins INTEGER NOT NULL DEFAULT 1000,
  coins       INTEGER NOT NULL DEFAULT 1000,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

ALTER TABLE season_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read season_participants"
  ON season_participants FOR SELECT USING (auth.role() = 'authenticated');
```

- [ ] **Step 3: Write the prop_pools table**

Add to the same migration file:

```sql
-- Prop pools (player performance bets)
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

CREATE UNIQUE INDEX prop_pools_match_player_stat
  ON prop_pools (faceit_match_id, player_id, stat_key);

ALTER TABLE prop_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read prop_pools"
  ON prop_pools FOR SELECT USING (auth.role() = 'authenticated');
```

- [ ] **Step 4: Alter existing tables**

Add to the same migration file:

```sql
-- Add season_id to betting_pools (nullable for legacy data)
ALTER TABLE betting_pools ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

-- Add prop_pool_id to bets (nullable — a bet is on either a pool or a prop)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS prop_pool_id UUID REFERENCES prop_pools(id);

-- Allow any bet amount >= 1 (remove old 10-500 range)
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_amount_check;
ALTER TABLE bets ADD CONSTRAINT bets_amount_positive CHECK (amount >= 1);

-- Exactly one of pool_id or prop_pool_id must be set
ALTER TABLE bets ADD CONSTRAINT bets_pool_xor_prop
  CHECK (
    (pool_id IS NOT NULL AND prop_pool_id IS NULL) OR
    (pool_id IS NULL AND prop_pool_id IS NOT NULL)
  );

-- Replace the old unique constraint with a partial one (match bets only)
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_pool_id_user_id_key;
CREATE UNIQUE INDEX bets_one_match_bet_per_user
  ON bets (pool_id, user_id) WHERE pool_id IS NOT NULL;
```

- [ ] **Step 5: Enable Realtime for new tables**

Add to the same migration file:

```sql
-- Enable Realtime for live odds updates
ALTER PUBLICATION supabase_realtime ADD TABLE prop_pools;
ALTER PUBLICATION supabase_realtime ADD TABLE season_participants;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_season_betting.sql
git commit -m "feat(db): add seasons, season_participants, prop_pools tables"
```

---

## Task 2: Database Migration — RPCs

**Files:**
- Modify: `supabase/migrations/009_season_betting.sql`

- [ ] **Step 1: Write the place_bet RPC**

Append to the migration file:

```sql
-- ============================================================
-- RPC: place_bet (replaces old version)
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
  v_season     seasons%ROWTYPE;
  v_participant season_participants%ROWTYPE;
  v_pool       betting_pools%ROWTYPE;
  v_prop       prop_pools%ROWTYPE;
  v_bet_id     UUID;
BEGIN
  -- Validate: exactly one pool reference
  IF (p_pool_id IS NULL) = (p_prop_pool_id IS NULL) THEN
    RETURN json_build_object('error', 'Exactly one of pool_id or prop_pool_id required');
  END IF;

  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN json_build_object('error', 'Amount must be at least 1');
  END IF;

  -- Verify active season
  SELECT * INTO v_season FROM seasons WHERE id = p_season_id;
  IF NOT FOUND OR v_season.status <> 'active' THEN
    RETURN json_build_object('error', 'No active season');
  END IF;

  -- Auto-join season if not yet a participant
  INSERT INTO season_participants (season_id, user_id)
    VALUES (p_season_id, p_user_id)
    ON CONFLICT (season_id, user_id) DO NOTHING;

  -- Lock participant row
  SELECT * INTO v_participant
    FROM season_participants
    WHERE season_id = p_season_id AND user_id = p_user_id
    FOR UPDATE;

  IF v_participant.coins < p_amount THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  -- Match outcome bet
  IF p_pool_id IS NOT NULL THEN
    IF p_side NOT IN ('team1', 'team2') THEN
      RETURN json_build_object('error', 'Invalid side for match bet');
    END IF;

    SELECT * INTO v_pool FROM betting_pools WHERE id = p_pool_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Pool not found');
    END IF;
    IF v_pool.status <> 'OPEN' THEN
      RETURN json_build_object('error', 'Pool is not open');
    END IF;
    IF now() >= v_pool.closes_at THEN
      UPDATE betting_pools SET status = 'CLOSED' WHERE id = p_pool_id;
      RETURN json_build_object('error', 'Betting window closed');
    END IF;

    -- Check duplicate match bet
    IF EXISTS (SELECT 1 FROM bets WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
      RETURN json_build_object('error', 'Already placed a bet on this match');
    END IF;

    -- Deduct coins
    UPDATE season_participants
      SET coins = coins - p_amount
      WHERE id = v_participant.id;

    -- Insert bet
    INSERT INTO bets (pool_id, user_id, side, amount)
      VALUES (p_pool_id, p_user_id, p_side, p_amount)
      RETURNING id INTO v_bet_id;

    -- Increment pool side
    IF p_side = 'team1' THEN
      UPDATE betting_pools SET team1_pool = team1_pool + p_amount WHERE id = p_pool_id;
    ELSE
      UPDATE betting_pools SET team2_pool = team2_pool + p_amount WHERE id = p_pool_id;
    END IF;

  -- Prop bet
  ELSE
    IF p_side NOT IN ('yes', 'no') THEN
      RETURN json_build_object('error', 'Invalid side for prop bet');
    END IF;

    SELECT * INTO v_prop FROM prop_pools WHERE id = p_prop_pool_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'Prop not found');
    END IF;
    IF v_prop.status <> 'open' THEN
      RETURN json_build_object('error', 'Prop is not open');
    END IF;
    IF now() >= v_prop.closes_at THEN
      UPDATE prop_pools SET status = 'closed' WHERE id = p_prop_pool_id;
      RETURN json_build_object('error', 'Betting window closed');
    END IF;

    -- Deduct coins
    UPDATE season_participants
      SET coins = coins - p_amount
      WHERE id = v_participant.id;

    -- Insert bet
    INSERT INTO bets (prop_pool_id, user_id, side, amount)
      VALUES (p_prop_pool_id, p_user_id, p_side, p_amount)
      RETURNING id INTO v_bet_id;

    -- Increment prop side
    IF p_side = 'yes' THEN
      UPDATE prop_pools SET yes_pool = yes_pool + p_amount WHERE id = p_prop_pool_id;
    ELSE
      UPDATE prop_pools SET no_pool = no_pool + p_amount WHERE id = p_prop_pool_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;
```

- [ ] **Step 2: Write the resolve_pool RPC (updated for season coins)**

Append to the migration file:

```sql
-- ============================================================
-- RPC: resolve_pool (updated — credits season_participants)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_pool(
  p_faceit_match_id TEXT,
  p_winning_team    TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool           betting_pools%ROWTYPE;
  v_bet            bets%ROWTYPE;
  v_winning_total  INTEGER;
  v_losing_total   INTEGER;
  v_payout         INTEGER;
BEGIN
  SELECT * INTO v_pool FROM betting_pools
    WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pool not found');
  END IF;
  IF v_pool.status = 'RESOLVED' THEN
    RETURN json_build_object('success', true, 'already_resolved', true);
  END IF;

  IF p_winning_team = 'team1' THEN
    v_winning_total := v_pool.team1_pool;
    v_losing_total := v_pool.team2_pool;
  ELSE
    v_winning_total := v_pool.team2_pool;
    v_losing_total := v_pool.team1_pool;
  END IF;

  -- If one side is empty, refund everyone
  IF v_winning_total = 0 OR v_losing_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
      UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
      UPDATE season_participants
        SET coins = coins + v_bet.amount
        WHERE season_id = v_pool.season_id AND user_id = v_bet.user_id;
    END LOOP;
    UPDATE betting_pools
      SET status = 'REFUNDED', resolved_at = now()
      WHERE id = v_pool.id;
    RETURN json_build_object('success', true, 'refunded', true);
  END IF;

  -- Pay winners
  FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
    IF v_bet.side = p_winning_team THEN
      v_payout := floor((v_bet.amount::numeric / v_winning_total) * v_losing_total) + v_bet.amount;
      UPDATE bets SET payout = v_payout WHERE id = v_bet.id;
      UPDATE season_participants
        SET coins = coins + v_payout
        WHERE season_id = v_pool.season_id AND user_id = v_bet.user_id;
    ELSE
      UPDATE bets SET payout = 0 WHERE id = v_bet.id;
    END IF;
  END LOOP;

  UPDATE betting_pools
    SET status = 'RESOLVED', winning_team = p_winning_team, resolved_at = now()
    WHERE id = v_pool.id;

  RETURN json_build_object('success', true);
END;
$$;
```

- [ ] **Step 3: Write the resolve_prop RPC**

Append to the migration file:

```sql
-- ============================================================
-- RPC: resolve_prop
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
    RETURN json_build_object('error', 'Prop not found');
  END IF;
  IF v_prop.status = 'resolved' THEN
    RETURN json_build_object('success', true, 'already_resolved', true);
  END IF;

  v_winning_side := CASE WHEN p_outcome THEN 'yes' ELSE 'no' END;

  IF p_outcome THEN
    v_winning_total := v_prop.yes_pool;
    v_losing_total := v_prop.no_pool;
  ELSE
    v_winning_total := v_prop.no_pool;
    v_losing_total := v_prop.yes_pool;
  END IF;

  -- If one side is empty, refund everyone
  IF v_winning_total = 0 OR v_losing_total = 0 THEN
    FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id LOOP
      UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
      UPDATE season_participants
        SET coins = coins + v_bet.amount
        WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
    END LOOP;
    UPDATE prop_pools
      SET status = 'refunded', outcome = p_outcome, resolved_at = now()
      WHERE id = v_prop.id;
    RETURN json_build_object('success', true, 'refunded', true);
  END IF;

  -- Pay winners
  FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id LOOP
    IF v_bet.side = v_winning_side THEN
      v_payout := floor((v_bet.amount::numeric / v_winning_total) * v_losing_total) + v_bet.amount;
      UPDATE bets SET payout = v_payout WHERE id = v_bet.id;
      UPDATE season_participants
        SET coins = coins + v_payout
        WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
    ELSE
      UPDATE bets SET payout = 0 WHERE id = v_bet.id;
    END IF;
  END LOOP;

  UPDATE prop_pools
    SET status = 'resolved', outcome = p_outcome, resolved_at = now()
    WHERE id = v_prop.id;

  RETURN json_build_object('success', true);
END;
$$;
```

- [ ] **Step 4: Write the cancel_pool and cancel_prop RPCs**

Append to the migration file:

```sql
-- ============================================================
-- RPC: cancel_pool (updated — credits season_participants)
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_pool(
  p_faceit_match_id TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pool betting_pools%ROWTYPE;
  v_bet  bets%ROWTYPE;
BEGIN
  SELECT * INTO v_pool FROM betting_pools
    WHERE faceit_match_id = p_faceit_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pool not found');
  END IF;
  IF v_pool.status IN ('RESOLVED', 'REFUNDED') THEN
    RETURN json_build_object('success', true, 'already_done', true);
  END IF;

  FOR v_bet IN SELECT * FROM bets WHERE pool_id = v_pool.id LOOP
    UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
    UPDATE season_participants
      SET coins = coins + v_bet.amount
      WHERE season_id = v_pool.season_id AND user_id = v_bet.user_id;
  END LOOP;

  UPDATE betting_pools
    SET status = 'REFUNDED', resolved_at = now()
    WHERE id = v_pool.id;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- RPC: cancel_prop
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
    RETURN json_build_object('error', 'Prop not found');
  END IF;
  IF v_prop.status IN ('resolved', 'refunded') THEN
    RETURN json_build_object('success', true, 'already_done', true);
  END IF;

  FOR v_bet IN SELECT * FROM bets WHERE prop_pool_id = v_prop.id LOOP
    UPDATE bets SET payout = v_bet.amount WHERE id = v_bet.id;
    UPDATE season_participants
      SET coins = coins + v_bet.amount
      WHERE season_id = v_prop.season_id AND user_id = v_bet.user_id;
  END LOOP;

  UPDATE prop_pools
    SET status = 'refunded', resolved_at = now()
    WHERE id = v_prop.id;

  RETURN json_build_object('success', true);
END;
$$;
```

- [ ] **Step 5: Drop the old daily allowance RPC**

Append to the migration file:

```sql
-- Remove daily allowance (no longer used in season system)
DROP FUNCTION IF EXISTS claim_daily_allowance(UUID);
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_season_betting.sql
git commit -m "feat(db): add season betting RPCs"
```

---

## Task 3: Types and Constants

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Add new types to types.ts**

Add after the existing betting types (around line 346):

```ts
export type PropBetSide = "yes" | "no";
export type PropPoolStatus = "open" | "closed" | "resolved" | "refunded";
export type SeasonStatus = "upcoming" | "active" | "completed";

export interface Season {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  status: SeasonStatus;
  prizes: Array<{ place: number; description: string }>;
  createdAt: string;
}

export interface SeasonParticipant {
  id: string;
  seasonId: string;
  userId: string;
  startingCoins: number;
  coins: number;
  joinedAt: string;
}

export interface PropPool {
  id: string;
  seasonId: string;
  faceitMatchId: string;
  playerId: string;
  playerNickname: string;
  statKey: "kills" | "kd" | "adr";
  threshold: number;
  description: string;
  yesPool: number;
  noPool: number;
  outcome: boolean | null;
  status: PropPoolStatus;
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface SeasonLeaderboardEntry {
  userId: string;
  nickname: string;
  coins: number;
  betsPlaced: number;
  betsWon: number;
  winRate: number;
}
```

- [ ] **Step 2: Update Bet type to include prop_pool_id**

Modify the existing `Bet` interface:

```ts
export interface Bet {
  amount: number;
  createdAt: string;
  id: string;
  payout: number | null;
  poolId: string | null;
  propPoolId: string | null;
  side: BetSide | PropBetSide;
  userId: string;
}
```

- [ ] **Step 3: Add ADMIN_USER_ID to constants**

In `src/lib/constants.ts`, add:

```ts
export const ADMIN_USER_ID = "soavarice-supabase-user-id";  // Replace with actual Supabase auth.users UUID for soavarice
```

Note: The actual UUID must be looked up from the `profiles` table or `auth.users` for the soavarice account. `MY_FACEIT_ID` is the FACEIT ID, not the Supabase user ID. You can derive it at runtime too — see Task 7 for the admin check approach.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat(types): add Season, PropPool, SeasonParticipant types"
```

---

## Task 4: Prop Generation Logic

**Files:**
- Create: `src/lib/prop-generation.ts`
- Create: `tests/lib/prop-generation.test.ts`

- [ ] **Step 1: Write failing tests for prop threshold generation**

```ts
// tests/lib/prop-generation.test.ts
import { describe, expect, it } from "vitest";
import { generatePropThresholds } from "~/lib/prop-generation";

describe("generatePropThresholds", () => {
  it("generates kills threshold as ceil of average", () => {
    const result = generatePropThresholds({
      avgKills: 20.3,
      avgKd: 1.15,
      avgAdr: 78.4,
    });
    expect(result.kills).toBe(21);
  });

  it("generates kd threshold rounded up to 1 decimal", () => {
    const result = generatePropThresholds({
      avgKills: 18,
      avgKd: 1.15,
      avgAdr: 75,
    });
    expect(result.kd).toBe(1.2);
  });

  it("generates adr threshold as ceil of average", () => {
    const result = generatePropThresholds({
      avgKills: 18,
      avgKd: 1.0,
      avgAdr: 78.4,
    });
    expect(result.adr).toBe(79);
  });

  it("handles whole number averages by adding 1", () => {
    const result = generatePropThresholds({
      avgKills: 20,
      avgKd: 1.0,
      avgAdr: 80,
    });
    // ceil(20) = 20, which is the same as avg — should use avg + 1
    expect(result.kills).toBe(21);
    expect(result.adr).toBe(81);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/prop-generation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write prop generation implementation**

```ts
// src/lib/prop-generation.ts

interface PlayerAverages {
  avgAdr: number;
  avgKd: number;
  avgKills: number;
}

interface PropThresholds {
  adr: number;
  kd: number;
  kills: number;
}

export function generatePropThresholds(averages: PlayerAverages): PropThresholds {
  return {
    kills: ceilAbove(averages.avgKills),
    kd: roundUpOneDecimal(averages.avgKd),
    adr: ceilAbove(averages.avgAdr),
  };
}

function ceilAbove(value: number): number {
  const ceiled = Math.ceil(value);
  return ceiled === value ? ceiled + 1 : ceiled;
}

function roundUpOneDecimal(value: number): number {
  const rounded = Math.ceil(value * 10) / 10;
  return rounded === value ? Math.round((rounded + 0.1) * 10) / 10 : rounded;
}

export function buildPropDescription(
  nickname: string,
  statKey: "kills" | "kd" | "adr",
  threshold: number
): string {
  const label = statKey === "kills" ? "kills" : statKey === "kd" ? "K/D" : "ADR";
  const thresholdStr = statKey === "kd" ? threshold.toFixed(1) : String(threshold);
  return `${nickname} ${thresholdStr}+ ${label}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/prop-generation.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for buildPropDescription**

Add to `tests/lib/prop-generation.test.ts`:

```ts
describe("buildPropDescription", () => {
  it("formats kills prop", () => {
    expect(buildPropDescription("Flaw1esss", "kills", 21)).toBe("Flaw1esss 21+ kills");
  });

  it("formats kd prop with 1 decimal", () => {
    expect(buildPropDescription("TibaBG", "kd", 1.2)).toBe("TibaBG 1.2+ K/D");
  });

  it("formats adr prop", () => {
    expect(buildPropDescription("soavarice", "adr", 79)).toBe("soavarice 79+ ADR");
  });
});
```

- [ ] **Step 6: Run tests to verify they pass** (implementation already covers this)

Run: `pnpm vitest run tests/lib/prop-generation.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/prop-generation.ts tests/lib/prop-generation.test.ts
git commit -m "feat(betting): add prop threshold generation logic"
```

---

## Task 5: Season Utilities

**Files:**
- Create: `src/lib/seasons.ts`
- Create: `tests/lib/seasons.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/seasons.test.ts
import { describe, expect, it } from "vitest";
import { getSeasonStatus, isSeasonActive, canCreateSeason } from "~/lib/seasons";

describe("getSeasonStatus", () => {
  it("returns upcoming when now is before starts_at", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const farFuture = new Date(Date.now() + 172800000).toISOString();
    expect(getSeasonStatus(future, farFuture)).toBe("upcoming");
  });

  it("returns active when now is between starts_at and ends_at", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getSeasonStatus(past, future)).toBe("active");
  });

  it("returns completed when now is after ends_at", () => {
    const past = new Date(Date.now() - 172800000).toISOString();
    const lessPast = new Date(Date.now() - 86400000).toISOString();
    expect(getSeasonStatus(past, lessPast)).toBe("completed");
  });
});

describe("isSeasonActive", () => {
  it("returns true for active status", () => {
    expect(isSeasonActive("active")).toBe(true);
  });

  it("returns false for upcoming or completed", () => {
    expect(isSeasonActive("upcoming")).toBe(false);
    expect(isSeasonActive("completed")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/seasons.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```ts
// src/lib/seasons.ts
import type { SeasonStatus } from "~/lib/types";

export function getSeasonStatus(startsAt: string, endsAt: string): SeasonStatus {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return "upcoming";
  if (now > new Date(endsAt).getTime()) return "completed";
  return "active";
}

export function isSeasonActive(status: SeasonStatus): boolean {
  return status === "active";
}

export function formatSeasonDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function calculateMultiplier(
  betAmount: number,
  sideTotal: number,
  otherSideTotal: number
): string {
  if (sideTotal === 0 || otherSideTotal === 0) return "—";
  const payout = Math.floor((betAmount / (sideTotal + betAmount)) * otherSideTotal) + betAmount;
  return `${(payout / betAmount).toFixed(1)}x`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/seasons.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasons.ts tests/lib/seasons.test.ts
git commit -m "feat(betting): add season utility functions"
```

---

## Task 6: Season Server Functions

**Files:**
- Create: `src/server/seasons.ts`
- Create: `tests/server/seasons.test.ts`

- [ ] **Step 1: Write the season server functions**

```ts
// src/server/seasons.ts
import { createServerFn } from "@tanstack/react-start";
import { createServerSupabase } from "~/lib/supabase.server";
import type { Season, SeasonLeaderboardEntry, SeasonParticipant } from "~/lib/types";

function rowToSeason(row: any): Season {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    status: row.status,
    prizes: row.prizes ?? [],
    createdAt: row.created_at,
  };
}

export const getActiveSeason = createServerFn({ method: "GET" }).handler(
  async (): Promise<Season | null> => {
    const supabase = createServerSupabase();

    // Check for active season
    const { data: activeRow } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "active")
      .single();

    if (activeRow) return rowToSeason(activeRow);

    // Check for upcoming season and auto-activate if time has passed
    const { data: upcomingRows } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "upcoming")
      .order("starts_at", { ascending: true })
      .limit(1);

    if (upcomingRows && upcomingRows.length > 0) {
      const row = upcomingRows[0];
      if (new Date(row.starts_at) <= new Date()) {
        await supabase
          .from("seasons")
          .update({ status: "active" })
          .eq("id", row.id);
        return rowToSeason({ ...row, status: "active" });
      }
      return rowToSeason(row);
    }

    // Check if active season should be completed
    // (handled by the auto-complete check below)
    return null;
  }
);

export const getSeasonCoinBalance = createServerFn({ method: "GET" })
  .inputValidator((input: { seasonId: string; userId: string }) => input)
  .handler(async ({ data }): Promise<number> => {
    const supabase = createServerSupabase();
    const { data: row } = await supabase
      .from("season_participants")
      .select("coins")
      .eq("season_id", data.seasonId)
      .eq("user_id", data.userId)
      .single();
    return row?.coins ?? 1000;
  });

export const getSeasonLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((seasonId: string) => seasonId)
  .handler(async ({ data: seasonId }): Promise<SeasonLeaderboardEntry[]> => {
    const supabase = createServerSupabase();

    const { data: participants } = await supabase
      .from("season_participants")
      .select("user_id, coins")
      .eq("season_id", seasonId)
      .order("coins", { ascending: false });

    if (!participants || participants.length === 0) return [];

    const userIds = participants.map((p: any) => p.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p.nickname])
    );

    // Count bets per user for this season
    const { data: bets } = await supabase
      .from("bets")
      .select("user_id, amount, payout, pool_id, prop_pool_id")
      .in("user_id", userIds);

    // Filter to only bets belonging to this season's pools/props
    const { data: seasonPools } = await supabase
      .from("betting_pools")
      .select("id")
      .eq("season_id", seasonId);

    const { data: seasonProps } = await supabase
      .from("prop_pools")
      .select("id")
      .eq("season_id", seasonId);

    const poolIds = new Set((seasonPools ?? []).map((p: any) => p.id));
    const propIds = new Set((seasonProps ?? []).map((p: any) => p.id));

    const seasonBets = (bets ?? []).filter(
      (b: any) =>
        (b.pool_id && poolIds.has(b.pool_id)) ||
        (b.prop_pool_id && propIds.has(b.prop_pool_id))
    );

    const betsByUser = new Map<string, any[]>();
    for (const bet of seasonBets) {
      const arr = betsByUser.get(bet.user_id) ?? [];
      arr.push(bet);
      betsByUser.set(bet.user_id, arr);
    }

    return participants.map((p: any) => {
      const userBets = betsByUser.get(p.user_id) ?? [];
      const resolved = userBets.filter((b: any) => b.payout !== null);
      const won = resolved.filter(
        (b: any) => b.payout !== null && b.payout > b.amount
      );
      return {
        userId: p.user_id,
        nickname: profileMap.get(p.user_id) ?? "Unknown",
        coins: p.coins,
        betsPlaced: userBets.length,
        betsWon: won.length,
        winRate:
          resolved.length > 0
            ? Math.round((won.length / resolved.length) * 100)
            : 0,
      };
    });
  });

export const createSeason = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      name: string;
      startsAt: string;
      endsAt: string;
      prizes: Array<{ place: number; description: string }>;
      userId: string;
    }) => input
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; season?: Season; error?: string }> => {
      const supabase = createServerSupabase();

      // Admin check: look up the user's profile nickname
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", data.userId)
        .single();

      if (profile?.nickname !== "soavarice") {
        return { success: false, error: "Only soavarice can create seasons" };
      }

      // Validate no overlapping seasons
      const { data: overlapping } = await supabase
        .from("seasons")
        .select("id")
        .or(
          `and(starts_at.lte.${data.endsAt},ends_at.gte.${data.startsAt})`
        )
        .not("status", "eq", "completed");

      if (overlapping && overlapping.length > 0) {
        return {
          success: false,
          error: "Season dates overlap with an existing season",
        };
      }

      const { data: row, error } = await supabase
        .from("seasons")
        .insert({
          name: data.name,
          starts_at: data.startsAt,
          ends_at: data.endsAt,
          created_by: data.userId,
          prizes: data.prizes,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, season: rowToSeason(row) };
    }
  );

export const completeSeason = createServerFn({ method: "POST" })
  .inputValidator((seasonId: string) => seasonId)
  .handler(
    async ({
      data: seasonId,
    }): Promise<{ success: boolean; error?: string }> => {
      const supabase = createServerSupabase();
      const { error } = await supabase
        .from("seasons")
        .update({ status: "completed" })
        .eq("id", seasonId)
        .eq("status", "active");

      if (error) return { success: false, error: error.message };
      return { success: true };
    }
  );

export const getSeasonHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<Season[]> => {
    const supabase = createServerSupabase();
    const { data: rows } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "completed")
      .order("ends_at", { ascending: false });

    return (rows ?? []).map(rowToSeason);
  }
);
```

- [ ] **Step 2: Write tests for season server functions**

```ts
// tests/server/seasons.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.20/node_modules/@tanstack/start-storage-context/dist/esm/index.js";

const supabaseMocks = vi.hoisted(() => {
  let seasons: any[] = [];
  let participants: any[] = [];
  let profiles: any[] = [];

  const single = vi.fn(async () => ({
    data: seasons.length > 0 ? seasons[0] : null,
  }));
  const selectSeasons = vi.fn(() => ({
    eq: vi.fn(() => ({
      single,
      order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: seasons })) })),
    })),
    or: vi.fn(() => ({
      not: vi.fn(async () => ({ data: [] })),
    })),
  }));
  const insertSeason = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: { id: "s1", name: "S1", starts_at: "2026-04-01", ends_at: "2026-05-01", created_by: "u1", status: "upcoming", prizes: [], created_at: "2026-03-28" },
        error: null,
      })),
    })),
  }));

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "seasons") return { select: selectSeasons, insert: insertSeason, update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })) };
        if (table === "season_participants") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: participants[0] ?? null })) })), order: vi.fn(async () => ({ data: participants })) })) })) };
        if (table === "profiles") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: profiles[0] ?? null })) })), in: vi.fn(async () => ({ data: profiles })) })) };
        if (table === "bets") return { select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [] })) })) };
        if (table === "betting_pools") return { select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [] })) })) };
        if (table === "prop_pools") return { select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [] })) })) };
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
    setSeasons(v: any[]) { seasons = v; },
    setParticipants(v: any[]) { participants = v; },
    setProfiles(v: any[]) { profiles = v; },
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => supabaseMocks.supabase,
}));

import { getActiveSeason, getSeasonCoinBalance } from "~/server/seasons";

afterEach(() => {
  vi.clearAllMocks();
  supabaseMocks.setSeasons([]);
  supabaseMocks.setParticipants([]);
  supabaseMocks.setProfiles([]);
});

describe("getActiveSeason", () => {
  it("returns null when no seasons exist", async () => {
    const result = await runWithStartContext(
      { contextAfterGlobalMiddlewares: {} },
      () => getActiveSeason()
    );
    expect(result).toBeNull();
  });
});

describe("getSeasonCoinBalance", () => {
  it("returns 1000 when user has no participant row", async () => {
    const result = await runWithStartContext(
      { contextAfterGlobalMiddlewares: {} },
      () => getSeasonCoinBalance({ data: { seasonId: "s1", userId: "u1" } })
    );
    expect(result).toBe(1000);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run tests/server/seasons.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/seasons.ts tests/server/seasons.test.ts
git commit -m "feat(betting): add season server functions"
```

---

## Task 7: Update Betting Server Functions

**Files:**
- Modify: `src/server/betting.ts`

- [ ] **Step 1: Update placeBet to use season coins and support props**

Replace the existing `placeBet` handler to call the new `place_bet` RPC with `p_season_id`:

```ts
export const placeBet = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      seasonId: string;
      poolId?: string;
      propPoolId?: string;
      side: string;
      amount: number;
      userId: string;
    }) => input
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const supabase = createServerSupabase();
    const { data: result, error } = await supabase.rpc("place_bet", {
      p_user_id: data.userId,
      p_season_id: data.seasonId,
      p_pool_id: data.poolId ?? null,
      p_prop_pool_id: data.propPoolId ?? null,
      p_side: data.side,
      p_amount: data.amount,
    });
    if (error) return { success: false, error: error.message };
    const parsed = result as any;
    if (parsed?.error) return { success: false, error: parsed.error };
    return { success: true };
  });
```

- [ ] **Step 2: Remove claimDailyAllowance and update getCoinBalance**

Delete the `claimDailyAllowance` export entirely. Update `getCoinBalance` to delegate to the season version (or remove it and use `getSeasonCoinBalance` from `seasons.ts` directly).

- [ ] **Step 3: Remove old getLeaderboard**

Delete the `getLeaderboard` function from `betting.ts` — it's replaced by `getSeasonLeaderboard` in `seasons.ts`.

- [ ] **Step 4: Add getPropPoolsForMatch server function**

Add to `src/server/betting.ts`:

```ts
export const getPropPoolsForMatch = createServerFn({ method: "GET" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }): Promise<PropPool[]> => {
    const supabase = createServerSupabase();
    const { data: rows } = await supabase
      .from("prop_pools")
      .select("*")
      .eq("faceit_match_id", faceitMatchId)
      .order("player_nickname", { ascending: true });

    return (rows ?? []).map((row: any) => ({
      id: row.id,
      seasonId: row.season_id,
      faceitMatchId: row.faceit_match_id,
      playerId: row.player_id,
      playerNickname: row.player_nickname,
      statKey: row.stat_key,
      threshold: Number(row.threshold),
      description: row.description,
      yesPool: row.yes_pool,
      noPool: row.no_pool,
      outcome: row.outcome,
      status: row.status,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    }));
  });
```

- [ ] **Step 5: Commit**

```bash
git add src/server/betting.ts
git commit -m "refactor(betting): update server functions for season system"
```

---

## Task 8: Prop Pool Creation in getLiveMatches

**Files:**
- Modify: `src/server/matches.ts`

- [ ] **Step 1: Import prop generation utilities**

Add imports at the top of `src/server/matches.ts`:

```ts
import { buildPropDescription, generatePropThresholds } from "~/lib/prop-generation";
```

- [ ] **Step 2: Add prop pool creation after match pool creation**

In the `getLiveMatches` handler, after the existing `betting_pools` upsert block (around line 455), add prop generation. The logic:

1. Query the active season
2. If no active season, skip prop generation
3. For each tracked player in the match roster, query their recent stats from `match_player_stats`
4. Generate thresholds and insert `prop_pools`

```ts
// After the betting_pools upsert...
// Generate prop pools for tracked players in this match
const { data: activeSeason } = await supabase
  .from("seasons")
  .select("id")
  .eq("status", "active")
  .single();

if (activeSeason) {
  const rosterPlayerIds = [
    ...liveMatch.teams.faction1.roster.map((p) => p.playerId),
    ...liveMatch.teams.faction2.roster.map((p) => p.playerId),
  ].filter((pid) => liveMatch.friendIds.includes(pid));

  for (const playerId of rosterPlayerIds) {
    // Get player's recent match stats for averages
    const { data: recentStats } = await supabase
      .from("match_player_stats")
      .select("kills, kd_ratio, adr, nickname")
      .eq("faceit_player_id", playerId)
      .order("played_at", { ascending: false })
      .limit(20);

    if (!recentStats || recentStats.length < 3) continue;

    const avgKills = recentStats.reduce((s, r) => s + r.kills, 0) / recentStats.length;
    const avgKd = recentStats.reduce((s, r) => s + r.kd_ratio, 0) / recentStats.length;
    const avgAdr = recentStats.reduce((s, r) => s + r.adr, 0) / recentStats.length;
    const nickname = recentStats[0].nickname;

    const thresholds = generatePropThresholds({ avgKills, avgKd, avgAdr });

    const statKeys = ["kills", "kd", "adr"] as const;
    const thresholdValues = {
      kills: thresholds.kills,
      kd: thresholds.kd,
      adr: thresholds.adr,
    };

    for (const statKey of statKeys) {
      const threshold = thresholdValues[statKey];
      const description = buildPropDescription(nickname, statKey, threshold);

      await supabase.from("prop_pools").upsert(
        {
          season_id: activeSeason.id,
          faceit_match_id: liveMatch.matchId,
          player_id: playerId,
          player_nickname: nickname,
          stat_key: statKey,
          threshold,
          description,
          opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
          closes_at: new Date(liveMatch.startedAt * 1000 + 5 * 60 * 1000).toISOString(),
        },
        { onConflict: "faceit_match_id,player_id,stat_key", ignoreDuplicates: true }
      );
    }
  }
}
```

Note: Add a unique index on `(faceit_match_id, player_id, stat_key)` to `prop_pools` in the migration to support the upsert dedup. Add this to Task 1 Step 3:

```sql
CREATE UNIQUE INDEX prop_pools_match_player_stat
  ON prop_pools (faceit_match_id, player_id, stat_key);
```

- [ ] **Step 3: Add season_id to pool creation upsert**

Update the existing `betting_pools` upsert to include `season_id`:

```ts
await supabase.from("betting_pools").upsert(
  {
    faceit_match_id: liveMatch.matchId,
    team1_name: team1Label,
    team2_name: team2Label,
    opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
    closes_at: new Date(liveMatch.startedAt * 1000 + 5 * 60 * 1000).toISOString(),
    match_started_at: new Date(liveMatch.startedAt * 1000).toISOString(),
    season_id: activeSeason?.id ?? null,
  },
  { onConflict: "faceit_match_id" }
);
```

- [ ] **Step 4: Add prop resolution to the stale pool sweep**

In the stale pool sweep section, after calling `resolve_pool`, also resolve associated props:

```ts
// After resolve_pool for a finished match...
// Resolve props for this match
const { data: matchProps } = await supabase
  .from("prop_pools")
  .select("id, stat_key, threshold, player_id")
  .eq("faceit_match_id", stalePool.faceit_match_id)
  .in("status", ["open", "closed"]);

if (matchProps && matchProps.length > 0) {
  // Fetch match stats to get actual player performance
  const { data: matchStats } = await supabase
    .from("match_player_stats")
    .select("faceit_player_id, kills, kd_ratio, adr")
    .eq("match_id", stalePool.faceit_match_id);

  const statsMap = new Map(
    (matchStats ?? []).map((s: any) => [s.faceit_player_id, s])
  );

  for (const prop of matchProps) {
    const playerStats = statsMap.get(prop.player_id);
    if (!playerStats) {
      // Player stats not found — cancel the prop
      await supabase.rpc("cancel_prop", { p_prop_pool_id: prop.id });
      continue;
    }

    const actualValue =
      prop.stat_key === "kills" ? playerStats.kills :
      prop.stat_key === "kd" ? playerStats.kd_ratio :
      playerStats.adr;

    const outcome = actualValue >= prop.threshold;
    await supabase.rpc("resolve_prop", {
      p_prop_pool_id: prop.id,
      p_outcome: outcome,
    });
  }
}
```

- [ ] **Step 5: Also cancel props when a match is cancelled**

In the cancellation branch of the stale pool sweep, add:

```ts
// Cancel all props for this match
const { data: cancelProps } = await supabase
  .from("prop_pools")
  .select("id")
  .eq("faceit_match_id", stalePool.faceit_match_id)
  .in("status", ["open", "closed"]);

for (const prop of (cancelProps ?? [])) {
  await supabase.rpc("cancel_prop", { p_prop_pool_id: prop.id });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat(betting): generate and resolve prop pools in match lifecycle"
```

---

## Task 9: Hooks — Season & Props

**Files:**
- Create: `src/hooks/useActiveSeason.ts`
- Create: `src/hooks/useSeasonLeaderboard.ts`
- Create: `src/hooks/useSeasonCoinBalance.ts`
- Create: `src/hooks/usePropPools.ts`
- Modify: `src/hooks/useCoinBalance.ts`

- [ ] **Step 1: Create useActiveSeason hook**

```ts
// src/hooks/useActiveSeason.ts
import { useQuery } from "@tanstack/react-query";
import { getActiveSeason } from "~/server/seasons";

export function useActiveSeason() {
  return useQuery({
    queryKey: ["active-season"],
    queryFn: () => getActiveSeason(),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Create useSeasonLeaderboard hook**

```ts
// src/hooks/useSeasonLeaderboard.ts
import { useQuery } from "@tanstack/react-query";
import { getSeasonLeaderboard } from "~/server/seasons";

export function useSeasonLeaderboard(seasonId: string | null) {
  return useQuery({
    queryKey: ["season-leaderboard", seasonId],
    queryFn: () => getSeasonLeaderboard({ data: seasonId! }),
    enabled: !!seasonId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Create useSeasonCoinBalance hook**

```ts
// src/hooks/useSeasonCoinBalance.ts
import { useQuery } from "@tanstack/react-query";
import { getSeasonCoinBalance } from "~/server/seasons";

export function useSeasonCoinBalance(seasonId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["season-coin-balance", seasonId, userId],
    queryFn: () =>
      getSeasonCoinBalance({ data: { seasonId: seasonId!, userId: userId! } }),
    enabled: !!(seasonId && userId),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Create usePropPools hook with Realtime**

```ts
// src/hooks/usePropPools.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getPropPoolsForMatch } from "~/server/betting";

const subscribeToPropPools = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (faceitMatchId: string, onUpdate: () => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const channel = getSupabaseClient()
      .channel(`props-${faceitMatchId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "prop_pools",
        filter: `faceit_match_id=eq.${faceitMatchId}`,
      }, onUpdate)
      .subscribe();
    return channel;
  });

export function usePropPools(faceitMatchId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["prop-pools", faceitMatchId];

  const query = useQuery({
    queryKey,
    queryFn: () => getPropPoolsForMatch({ data: faceitMatchId }),
    enabled: !!faceitMatchId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!faceitMatchId) return;
    let channel: any;
    subscribeToPropPools(faceitMatchId, () => {
      queryClient.invalidateQueries({ queryKey });
    }).then((ch) => { channel = ch; });
    return () => { channel?.unsubscribe(); };
  }, [faceitMatchId, queryClient]);

  return query;
}
```

- [ ] **Step 5: Update useCoinBalance to remove daily allowance claim**

In `src/hooks/useCoinBalance.ts`, remove the `useEffect` that calls `claimDailyAllowance`. The hook can either be replaced by `useSeasonCoinBalance` or simplified to just read season balance. For backward compatibility during migration, keep the file but have it delegate:

```ts
// src/hooks/useCoinBalance.ts
import { useSeasonCoinBalance } from "~/hooks/useSeasonCoinBalance";

export function useCoinBalance(seasonId: string | null, userId: string | null) {
  return useSeasonCoinBalance(seasonId, userId);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useActiveSeason.ts src/hooks/useSeasonLeaderboard.ts src/hooks/useSeasonCoinBalance.ts src/hooks/usePropPools.ts src/hooks/useCoinBalance.ts
git commit -m "feat(betting): add season and prop pool hooks"
```

---

## Task 10: BetCard Component

**Files:**
- Create: `src/components/BetCard.tsx`
- Create: `tests/components/bet-card.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/components/bet-card.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BetCard } from "~/components/BetCard";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe("BetCard", () => {
  it("renders match bet card with two team buttons", () => {
    const html = renderToStaticMarkup(
      <BetCard
        type="match"
        id="pool-1"
        seasonId="s1"
        userId="u1"
        userCoins={1000}
        label="de_mirage"
        closesAt={new Date(Date.now() + 300000).toISOString()}
        status="OPEN"
        side1={{ label: "Team Flaw1esss", pool: 200 }}
        side2={{ label: "Team bizzFXR", pool: 100 }}
      />
    );
    expect(html).toContain("Team Flaw1esss");
    expect(html).toContain("Team bizzFXR");
    expect(html).toContain("ALL IN");
  });

  it("renders prop bet card with yes/no buttons", () => {
    const html = renderToStaticMarkup(
      <BetCard
        type="prop"
        id="prop-1"
        seasonId="s1"
        userId="u1"
        userCoins={1000}
        label="Flaw1esss 21+ kills"
        sublabel="avg 20.3 kills last 20"
        closesAt={new Date(Date.now() + 300000).toISOString()}
        status="open"
        side1={{ label: "YES", pool: 150 }}
        side2={{ label: "NO", pool: 50 }}
      />
    );
    expect(html).toContain("Flaw1esss 21+ kills");
    expect(html).toContain("YES");
    expect(html).toContain("NO");
    expect(html).toContain("ALL IN");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/bet-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write BetCard component**

```tsx
// src/components/BetCard.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { calculateReturnPct } from "~/lib/betting";
import { placeBet } from "~/server/betting";

interface BetCardSide {
  label: string;
  pool: number;
}

interface BetCardProps {
  type: "match" | "prop";
  id: string;
  seasonId: string;
  userId: string | null;
  userCoins: number;
  label: string;
  sublabel?: string;
  closesAt: string;
  status: string;
  side1: BetCardSide;
  side2: BetCardSide;
  existingBet?: { side: string; amount: number; payout: number | null } | null;
}

export function BetCard({
  type,
  id,
  seasonId,
  userId,
  userCoins,
  label,
  sublabel,
  closesAt,
  status,
  side1,
  side2,
  existingBet,
}: BetCardProps) {
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isOpen = status === "OPEN" || status === "open";
  const closesAtMs = new Date(closesAt).getTime();

  useEffect(() => {
    if (!isOpen) return;
    const tick = () => {
      const diff = Math.max(0, closesAtMs - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(diff > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : "Closed");
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [closesAtMs, isOpen]);

  const side1Key = type === "match" ? "team1" : "yes";
  const side2Key = type === "match" ? "team2" : "no";

  const side1Pct = side1.pool > 0 ? `${calculateReturnPct(100, side1.pool + 100, side2.pool)}%` : "—";
  const side2Pct = side2.pool > 0 ? `${calculateReturnPct(100, side2.pool + 100, side1.pool)}%` : "—";

  const hasBet = !!existingBet;
  const betAmount = Number(amount) || 0;

  async function handleBet() {
    if (!userId || !selectedSide || betAmount < 1) return;
    setLoading(true);
    setError(null);

    const result = await placeBet({
      data: {
        seasonId,
        ...(type === "match" ? { poolId: id } : { propPoolId: id }),
        side: selectedSide,
        amount: betAmount,
        userId,
      },
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Failed to place bet");
      return;
    }

    setSelectedSide(null);
    setAmount("");
    queryClient.invalidateQueries({ queryKey: ["betting-pool"] });
    queryClient.invalidateQueries({ queryKey: ["prop-pools"] });
    queryClient.invalidateQueries({ queryKey: ["season-coin-balance"] });
    queryClient.invalidateQueries({ queryKey: ["season-leaderboard"] });
  }

  function handleAllIn() {
    setAmount(String(userCoins));
  }

  const canBet = isOpen && !hasBet && userId && selectedSide && betAmount >= 1 && betAmount <= userCoins && !loading;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-bold text-sm text-text">{label}</div>
          {sublabel && (
            <div className="text-text-dim text-xs">{sublabel}</div>
          )}
        </div>
        {isOpen && (
          <span className="text-accent text-xs font-mono">⏱ {timeLeft}</span>
        )}
      </div>

      {hasBet ? (
        <div className="rounded bg-accent/10 border border-accent/30 p-3 text-sm">
          <span className="text-text-muted">Your bet: </span>
          <span className="text-accent font-bold">
            {existingBet!.amount} 🪙 on {existingBet!.side}
          </span>
          {existingBet!.payout !== null && (
            <span className="ml-2 text-text-muted">
              → {existingBet!.payout > 0 ? `+${existingBet!.payout} 🪙` : "Lost"}
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-md border p-2 text-center text-sm font-bold transition-colors ${
                selectedSide === side1Key
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-bg-elevated text-text hover:border-accent/50"
              }`}
              disabled={!isOpen}
              onClick={() => setSelectedSide(side1Key)}
            >
              <div>{side1.label}</div>
              <div className="text-text-dim text-xs font-normal">
                {side1.pool} 🪙 • {side1Pct}
              </div>
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md border p-2 text-center text-sm font-bold transition-colors ${
                selectedSide === side2Key
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-bg-elevated text-text hover:border-accent/50"
              }`}
              disabled={!isOpen}
              onClick={() => setSelectedSide(side2Key)}
            >
              <div>{side2.label}</div>
              <div className="text-text-dim text-xs font-normal">
                {side2.pool} 🪙 • {side2Pct}
              </div>
            </button>
          </div>

          {isOpen && (
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text"
                disabled={!isOpen || loading}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount..."
                type="number"
                min={1}
                max={userCoins}
                value={amount}
              />
              <button
                type="button"
                className="rounded bg-accent px-4 py-2 text-sm font-bold text-bg-elevated disabled:opacity-50"
                disabled={!canBet}
                onClick={handleBet}
              >
                {loading ? "..." : "BET"}
              </button>
              <button
                type="button"
                className="rounded bg-error/20 px-3 py-2 text-sm font-bold text-error"
                disabled={!isOpen || userCoins === 0}
                onClick={handleAllIn}
              >
                ALL IN
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2 text-error text-xs">{error}</div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/components/bet-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BetCard.tsx tests/components/bet-card.test.tsx
git commit -m "feat(betting): add BetCard component for match and prop bets"
```

---

## Task 11: Season UI Components

**Files:**
- Create: `src/components/SeasonHeader.tsx`
- Create: `src/components/SeasonLeaderboardTab.tsx`
- Create: `src/components/LiveBetsTab.tsx`
- Create: `src/components/SeasonMyBetsTab.tsx`
- Create: `src/components/SeasonHistoryTab.tsx`
- Create: `src/components/CreateSeasonForm.tsx`

- [ ] **Step 1: Create SeasonHeader**

```tsx
// src/components/SeasonHeader.tsx
import type { Season } from "~/lib/types";
import { formatSeasonDateRange } from "~/lib/seasons";

interface SeasonHeaderProps {
  season: Season;
  userCoins: number | null;
}

export function SeasonHeader({ season, userCoins }: SeasonHeaderProps) {
  const statusColors: Record<string, string> = {
    upcoming: "bg-yellow-500/20 text-yellow-400",
    active: "bg-accent/20 text-accent",
    completed: "bg-text-dim/20 text-text-dim",
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-lg text-text">{season.name}</h2>
        <span className="text-text-dim text-sm">
          {formatSeasonDateRange(season.startsAt, season.endsAt)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusColors[season.status] ?? ""}`}
        >
          {season.status}
        </span>
      </div>
      {userCoins !== null && (
        <div className="text-accent font-bold text-sm">
          {userCoins.toLocaleString()} 🪙
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create SeasonLeaderboardTab**

```tsx
// src/components/SeasonLeaderboardTab.tsx
import { useSeasonLeaderboard } from "~/hooks/useSeasonLeaderboard";
import type { Season } from "~/lib/types";

interface SeasonLeaderboardTabProps {
  season: Season;
  userId: string | null;
}

export function SeasonLeaderboardTab({ season, userId }: SeasonLeaderboardTabProps) {
  const { data: entries, isLoading } = useSeasonLeaderboard(season.id);

  if (isLoading) {
    return <div className="animate-pulse text-accent text-sm">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {(entries ?? []).map((entry, i) => {
          const isMe = entry.userId === userId;
          return (
            <div
              key={entry.userId}
              className={`grid grid-cols-[2rem_1fr_5rem_4rem_4rem] items-center gap-2 rounded px-3 py-2 text-sm ${
                isMe ? "border-accent border-l-2 bg-accent/10" : "bg-bg-elevated"
              }`}
            >
              <span className="font-bold text-xs text-text-dim">{i + 1}</span>
              <span className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}>
                {entry.nickname}
              </span>
              <span className="text-right font-bold text-accent">
                {entry.coins.toLocaleString()} 🪙
              </span>
              <span className="text-right text-text-muted text-xs">
                {entry.betsPlaced} bets
              </span>
              <span className="text-right text-text-muted text-xs">
                {entry.winRate}% win
              </span>
            </div>
          );
        })}

        {(!entries || entries.length === 0) && (
          <div className="text-text-dim text-sm text-center py-8">
            No participants yet. Place the first bet to join!
          </div>
        )}
      </div>

      {season.prizes.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="mb-2 text-xs font-bold uppercase text-text-dim">Prizes</div>
          {season.prizes.map((prize) => (
            <div key={prize.place} className="flex items-center gap-2 text-sm">
              <span className="text-accent font-bold">
                {prize.place === 1 ? "🥇" : prize.place === 2 ? "🥈" : "🥉"} {prize.place}st
              </span>
              <span className="text-text">{prize.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create LiveBetsTab**

```tsx
// src/components/LiveBetsTab.tsx
import { BetCard } from "~/components/BetCard";
import { useBettingPool } from "~/hooks/useBettingPool";
import { usePropPools } from "~/hooks/usePropPools";
import type { LiveMatch } from "~/lib/types";

interface LiveBetsTabProps {
  liveMatches: LiveMatch[];
  seasonId: string;
  userId: string | null;
  userCoins: number;
}

export function LiveBetsTab({ liveMatches, seasonId, userId, userCoins }: LiveBetsTabProps) {
  if (liveMatches.length === 0) {
    return (
      <div className="text-text-dim text-sm text-center py-8">
        No live matches right now. Check back when a match starts!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {liveMatches.map((match) => (
        <LiveMatchBets
          key={match.matchId}
          match={match}
          seasonId={seasonId}
          userId={userId}
          userCoins={userCoins}
        />
      ))}
    </div>
  );
}

function LiveMatchBets({
  match,
  seasonId,
  userId,
  userCoins,
}: {
  match: LiveMatch;
  seasonId: string;
  userId: string | null;
  userCoins: number;
}) {
  const { data: betData } = useBettingPool(match.matchId, userId);
  const { data: props } = usePropPools(match.matchId);

  const pool = betData?.pool;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-dim">{match.map}</span>
        <span className="text-text-dim">•</span>
        <span className="text-accent font-bold">{match.status}</span>
      </div>

      {pool && (
        <BetCard
          type="match"
          id={pool.id}
          seasonId={seasonId}
          userId={userId}
          userCoins={userCoins}
          label={`${pool.team1Name} vs ${pool.team2Name}`}
          closesAt={pool.closesAt}
          status={pool.status}
          side1={{ label: pool.team1Name, pool: pool.team1Pool }}
          side2={{ label: pool.team2Name, pool: pool.team2Pool }}
          existingBet={betData?.userBet ? {
            side: betData.userBet.side,
            amount: betData.userBet.amount,
            payout: betData.userBet.payout,
          } : null}
        />
      )}

      {(props ?? []).map((prop) => (
        <BetCard
          key={prop.id}
          type="prop"
          id={prop.id}
          seasonId={seasonId}
          userId={userId}
          userCoins={userCoins}
          label={prop.description}
          sublabel={`threshold: ${prop.statKey === "kd" ? prop.threshold.toFixed(1) : prop.threshold}`}
          closesAt={prop.closesAt}
          status={prop.status}
          side1={{ label: "YES", pool: prop.yesPool }}
          side2={{ label: "NO", pool: prop.noPool }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create SeasonMyBetsTab**

```tsx
// src/components/SeasonMyBetsTab.tsx
import { useQuery } from "@tanstack/react-query";
import { getUserBetHistory } from "~/server/betting";

interface SeasonMyBetsTabProps {
  seasonId: string;
  userId: string | null;
}

export function SeasonMyBetsTab({ seasonId, userId }: SeasonMyBetsTabProps) {
  const { data: bets, isLoading } = useQuery({
    queryKey: ["season-my-bets", seasonId, userId],
    queryFn: () => getUserBetHistory({ data: userId! }),
    enabled: !!userId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="animate-pulse text-accent text-sm">Loading...</div>;
  }

  if (!bets || bets.length === 0) {
    return (
      <div className="text-text-dim text-sm text-center py-8">
        No bets placed this season yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {bets.map((bet: any) => (
        <div
          key={bet.id}
          className="grid grid-cols-[1fr_4rem_4rem_4rem] items-center gap-2 rounded bg-bg-elevated px-3 py-2 text-sm"
        >
          <div className="truncate text-text">
            {bet.pool?.team1Name ?? bet.propDescription ?? "—"}{" "}
            <span className="text-accent text-xs">{bet.side}</span>
          </div>
          <span className="text-right text-text-muted">{bet.amount} 🪙</span>
          <span className="text-right text-text-muted">
            {bet.payout !== null ? `${bet.payout} 🪙` : "—"}
          </span>
          <span
            className={`text-right text-xs font-bold ${
              bet.payout !== null && bet.payout > bet.amount
                ? "text-accent"
                : bet.payout === 0
                  ? "text-error"
                  : "text-text-dim"
            }`}
          >
            {bet.payout === null
              ? "Pending"
              : bet.payout > bet.amount
                ? "Won"
                : bet.payout === bet.amount
                  ? "Refunded"
                  : "Lost"}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create SeasonHistoryTab**

```tsx
// src/components/SeasonHistoryTab.tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SeasonLeaderboardTab } from "~/components/SeasonLeaderboardTab";
import { getSeasonHistory } from "~/server/seasons";
import type { Season } from "~/lib/types";

interface SeasonHistoryTabProps {
  userId: string | null;
}

export function SeasonHistoryTab({ userId }: SeasonHistoryTabProps) {
  const { data: seasons, isLoading } = useQuery({
    queryKey: ["season-history"],
    queryFn: () => getSeasonHistory(),
    staleTime: 60_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="animate-pulse text-accent text-sm">Loading...</div>;
  }

  if (!seasons || seasons.length === 0) {
    return (
      <div className="text-text-dim text-sm text-center py-8">
        No completed seasons yet.
      </div>
    );
  }

  const selected = seasons.find((s) => s.id === selectedId) ?? seasons[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {seasons.map((season) => (
          <button
            key={season.id}
            type="button"
            className={`rounded px-3 py-1 text-sm font-bold ${
              season.id === selected.id
                ? "bg-accent text-bg-elevated"
                : "bg-bg-elevated text-text-muted hover:text-text"
            }`}
            onClick={() => setSelectedId(season.id)}
          >
            {season.name}
          </button>
        ))}
      </div>
      <SeasonLeaderboardTab season={selected} userId={userId} />
    </div>
  );
}
```

- [ ] **Step 6: Create CreateSeasonForm**

```tsx
// src/components/CreateSeasonForm.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createSeason } from "~/server/seasons";

interface CreateSeasonFormProps {
  userId: string;
}

export function CreateSeasonForm({ userId }: CreateSeasonFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [prizeDesc, setPrizeDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !startsAt || !endsAt) return;

    setLoading(true);
    setError(null);

    const prizes = prizeDesc.trim()
      ? [{ place: 1, description: prizeDesc.trim() }]
      : [];

    const result = await createSeason({
      data: {
        name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        prizes,
        userId,
      },
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create season");
      return;
    }

    setName("");
    setStartsAt("");
    setEndsAt("");
    setPrizeDesc("");
    queryClient.invalidateQueries({ queryKey: ["active-season"] });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-bg-elevated p-4 flex flex-col gap-3">
      <h3 className="font-bold text-sm text-text">Create Season</h3>

      <input
        className="rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text"
        onChange={(e) => setName(e.target.value)}
        placeholder="Season name..."
        value={name}
      />

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text"
          onChange={(e) => setStartsAt(e.target.value)}
          type="date"
          value={startsAt}
        />
        <input
          className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text"
          onChange={(e) => setEndsAt(e.target.value)}
          type="date"
          value={endsAt}
        />
      </div>

      <input
        className="rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text"
        onChange={(e) => setPrizeDesc(e.target.value)}
        placeholder="1st place prize (optional)..."
        value={prizeDesc}
      />

      {error && <div className="text-error text-xs">{error}</div>}

      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 text-sm font-bold text-bg-elevated disabled:opacity-50"
        disabled={loading || !name || !startsAt || !endsAt}
      >
        {loading ? "Creating..." : "Create Season"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SeasonHeader.tsx src/components/SeasonLeaderboardTab.tsx src/components/LiveBetsTab.tsx src/components/SeasonMyBetsTab.tsx src/components/SeasonHistoryTab.tsx src/components/CreateSeasonForm.tsx
git commit -m "feat(betting): add season UI components"
```

---

## Task 12: Rebuild /bets Route

**Files:**
- Modify: `src/routes/_authed/bets.tsx`
- Modify: `src/components/CoinBalance.tsx`
- Modify: `src/routes/_authed.tsx`

- [ ] **Step 1: Rewrite the bets route**

Replace the contents of `src/routes/_authed/bets.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CreateSeasonForm } from "~/components/CreateSeasonForm";
import { LiveBetsTab } from "~/components/LiveBetsTab";
import { PageSectionTabs } from "~/components/PageSectionTabs";
import { SeasonHeader } from "~/components/SeasonHeader";
import { SeasonHistoryTab } from "~/components/SeasonHistoryTab";
import { SeasonLeaderboardTab } from "~/components/SeasonLeaderboardTab";
import { SeasonMyBetsTab } from "~/components/SeasonMyBetsTab";
import { useActiveSeason } from "~/hooks/useActiveSeason";
import { useSeasonCoinBalance } from "~/hooks/useSeasonCoinBalance";
import { MY_NICKNAME } from "~/lib/constants";

type BetsTab = "leaderboard" | "live" | "my-bets" | "history";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session;
  });

export const Route = createFileRoute("/_authed/bets")({
  validateSearch: (search: Record<string, unknown>) => {
    const valid: BetsTab[] = ["leaderboard", "live", "my-bets", "history"];
    const tab = valid.includes(search.tab as BetsTab)
      ? (search.tab as BetsTab)
      : "leaderboard";
    return { tab };
  },
  component: BetsPage,
});

function BetsPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  const { data: season, isLoading: seasonLoading } = useActiveSeason();
  const { data: userCoins } = useSeasonCoinBalance(
    season?.status === "active" ? season.id : null,
    userId
  );

  useEffect(() => {
    getClientSession().then(async (session) => {
      setUserId(session?.user.id ?? null);
      setAuthResolved(true);

      // Check admin status
      if (session?.user.id) {
        const { getSupabaseClient } = await import("~/lib/supabase.client");
        const { data: profile } = await getSupabaseClient()
          .from("profiles")
          .select("nickname")
          .eq("id", session.user.id)
          .single();
        setIsAdmin(profile?.nickname === MY_NICKNAME);
      }
    });
  }, []);

  useEffect(() => {
    if (authResolved && !userId) {
      navigate({ to: "/sign-in", replace: true });
    }
  }, [authResolved, userId, navigate]);

  if (!authResolved || seasonLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-accent text-sm">Loading...</div>
      </div>
    );
  }

  const activeSeason = season?.status === "active" ? season : null;
  const upcomingSeason = season?.status === "upcoming" ? season : null;

  const sectionTabs = [
    { key: "leaderboard", label: "Leaderboard" },
    { key: "live", label: "Live Bets" },
    { key: "my-bets", label: "My Bets" },
    { key: "history", label: "History" },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {activeSeason && (
            <>
              <SeasonHeader season={activeSeason} userCoins={userCoins ?? null} />
              <PageSectionTabs
                activeKey={tab}
                onChange={(next) =>
                  navigate({ to: "/bets", search: { tab: next as BetsTab }, replace: true })
                }
                tabs={sectionTabs}
              />
              {tab === "leaderboard" && (
                <SeasonLeaderboardTab season={activeSeason} userId={userId} />
              )}
              {tab === "live" && (
                <LiveBetsTab
                  liveMatches={[]}
                  seasonId={activeSeason.id}
                  userId={userId}
                  userCoins={userCoins ?? 1000}
                />
              )}
              {tab === "my-bets" && (
                <SeasonMyBetsTab seasonId={activeSeason.id} userId={userId} />
              )}
              {tab === "history" && <SeasonHistoryTab userId={userId} />}
            </>
          )}

          {!activeSeason && upcomingSeason && (
            <div className="text-center py-12">
              <SeasonHeader season={upcomingSeason} userCoins={null} />
              <p className="mt-4 text-text-muted text-sm">
                Season starts soon. Betting opens when the season is active.
              </p>
            </div>
          )}

          {!activeSeason && !upcomingSeason && (
            <div className="text-center py-12">
              <p className="text-text-dim text-sm">No active season.</p>
              <SeasonHistoryTab userId={userId} />
            </div>
          )}

          {isAdmin && !activeSeason && !upcomingSeason && userId && (
            <CreateSeasonForm userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update CoinBalance component**

Update `src/components/CoinBalance.tsx` to use season-scoped balance. Read the file first to understand the current structure, then update to use `useSeasonCoinBalance` with the active season ID. Show "—" when no active season.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authed/bets.tsx src/components/CoinBalance.tsx src/routes/_authed.tsx
git commit -m "feat(betting): rebuild /bets route as season hub"
```

---

## Task 13: Wire Live Matches into Bets Page

**Files:**
- Modify: `src/routes/_authed/bets.tsx`

- [ ] **Step 1: Add live match fetching to BetsPage**

The `/bets` page needs to show live matches in the "Live Bets" tab. Import the existing `useLiveMatches` hook (or `getLiveMatches` server fn) and pass the results to `LiveBetsTab`. This follows the same pattern as the home page's `HomeLiveMatchesSection`.

Look at how `src/components/HomeLiveMatchesSection.tsx` fetches and passes live matches, then replicate that pattern in the `BetsPage` component, passing the live matches to `LiveBetsTab`.

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authed/bets.tsx
git commit -m "feat(betting): wire live matches into bets page"
```

---

## Task 14: Clean Up Old Betting Code

**Files:**
- Modify: `src/server/betting.ts` — remove `claimDailyAllowance`, old `getLeaderboard`
- Modify: `src/hooks/useCoinBalance.ts` — remove daily allowance effect
- Modify: `src/components/BettingPanel.tsx` — remove or refactor (replaced by BetCard in LiveBetsTab)
- Delete or empty: `src/components/BetsLeaderboardTab.tsx` — replaced by SeasonLeaderboardTab
- Delete or empty: `src/components/BetHistoryTab.tsx` — replaced by SeasonMyBetsTab
- Modify: `src/lib/betting-stats.ts` — update if needed for prop bets

- [ ] **Step 1: Remove deprecated server functions**

Remove from `src/server/betting.ts`:
- `claimDailyAllowance` function
- Old `getLeaderboard` function (replaced by `getSeasonLeaderboard` in `seasons.ts`)

- [ ] **Step 2: Remove old components**

Delete the contents of `BetsLeaderboardTab.tsx` and `BetHistoryTab.tsx` or remove the files if no other code imports them. Check for imports first.

- [ ] **Step 3: Update BettingPanel or remove it**

If `BettingPanel` is still used on the home page's `LiveMatchCard`, update it to use `BetCard` internally. If the home page no longer shows betting inline (all betting moved to `/bets`), remove `BettingPanel`.

- [ ] **Step 4: Run all tests**

Run: `pnpm vitest run`
Expected: All tests pass. Fix any broken imports or references.

- [ ] **Step 5: Run linting**

Run: `pnpm dlx ultracite check`
Fix any issues.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(betting): remove deprecated betting code"
```

---

## Task 15: Update Tests for New System

**Files:**
- Modify: `tests/server/betting.test.ts`
- Modify: `tests/components/bets-leaderboard-tab.test.tsx`
- Modify: `tests/components/bet-history-tab.test.tsx`
- Modify: `tests/lib/betting.test.ts`

- [ ] **Step 1: Update betting server tests**

Update `tests/server/betting.test.ts` to test the new `placeBet` signature (with `seasonId`, `propPoolId`). Remove tests for `claimDailyAllowance` and old `getLeaderboard`.

- [ ] **Step 2: Update or replace component tests**

Update `tests/components/bets-leaderboard-tab.test.tsx` to test `SeasonLeaderboardTab` instead. Update `tests/components/bet-history-tab.test.tsx` to test `SeasonMyBetsTab` instead.

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(betting): update tests for season betting system"
```

---

## Task 16: Final Integration & Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: All 400+ tests pass.

- [ ] **Step 2: Run linting**

Run: `pnpm dlx ultracite check`
Expected: No errors.

- [ ] **Step 3: Test build**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual smoke test**

Start dev server: `pnpm dev`

Verify:
1. `/bets` shows "No active season" when no season exists
2. As soavarice, "Create Season" form appears
3. Creating a season works
4. Season leaderboard shows (empty initially)
5. Live Bets tab shows live matches with match outcome cards + prop cards
6. Placing a match bet works, coins deducted
7. Placing a prop bet works, coins deducted
8. ALL IN button fills the amount field with full balance
9. CoinBalance in nav shows season coins
10. After match resolves, payouts credited correctly

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(betting): season-based betting system complete"
```
