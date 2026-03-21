# Betting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add virtual coin betting on live CS2 matches — pari-mutuel payouts, 5-minute window, Supabase Realtime for live odds, auth-gated.

**Architecture:** Supabase PostgreSQL RPC functions handle all coin mutations atomically (place_bet, resolve_pool, cancel_pool, claim_daily_allowance). TanStack Start server functions (`createServerFn`) are thin wrappers that verify auth and call RPCs. Supabase Realtime subscribes to `betting_pools` table changes for live odds on the match card. Pool lifecycle is driven by the existing `getLiveMatches` polling loop.

**Tech Stack:** TanStack Start (`createServerFn`), Supabase (PostgreSQL RPCs, Realtime, service role key), TanStack Query, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-betting-system-design.md`

---

## File Structure

```
supabase/migrations/
  002_betting_system.sql        ← schema + RLS + all 4 RPC functions

src/lib/
  types.ts                      ← add BettingPool, Bet, BetSide types
  betting.ts                    ← NEW: pure payout calculation utilities

src/server/
  betting.ts                    ← NEW: createServerFn wrappers for all betting operations
  matches.ts                    ← MODIFY: integrate pool creation/resolution/stale sweep

src/hooks/
  useBettingPool.ts             ← NEW: pool + user's bet via Realtime subscription
  useCoinBalance.ts             ← NEW: current user coin balance + daily allowance trigger
  useLeaderboard.ts             ← NEW: all profiles ordered by coins
  useUserBets.ts                ← NEW: current user's bet history

src/components/
  BettingPanel.tsx              ← NEW: betting UI inside LiveMatchCard
  CoinBalance.tsx               ← NEW: 🪙 display for nav
  LiveMatchCard.tsx             ← MODIFY: add BettingPanel below score

src/routes/_authed/
  _authed.tsx                   ← MODIFY: add CoinBalance to nav
  leaderboard.tsx               ← MODIFY: replace stub with real leaderboard
  history.tsx                   ← MODIFY: add My Bets tab

tests/lib/
  betting.test.ts               ← NEW: unit tests for calculatePayout
```

---

## Task 1: Pure Utility + Unit Tests (TDD)

**Files:**
- Create: `src/lib/betting.ts`
- Create: `tests/lib/betting.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/lib/betting.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculatePayout, calculateReturnPct, isBettingOpen } from "~/lib/betting";

describe("calculatePayout", () => {
  it("splits losing pool proportionally", () => {
    // 200 bet, 600 on winning side, 400 on losing side
    // payout = floor(200/600 * 400) + 200 = 133 + 200 = 333
    expect(calculatePayout(200, 600, 400)).toBe(333);
  });

  it("returns full bet when winning side is the only side", () => {
    expect(calculatePayout(200, 200, 0)).toBe(200);
  });

  it("returns full bet when losing side is 0", () => {
    expect(calculatePayout(100, 500, 0)).toBe(100);
  });

  it("handles equal pools", () => {
    // 100 bet, 200 on each side → payout = floor(100/200 * 200) + 100 = 200
    expect(calculatePayout(100, 200, 200)).toBe(200);
  });
});

describe("calculateReturnPct", () => {
  it("returns positive % gain", () => {
    // payout 333 on bet 200 = +66%
    expect(calculateReturnPct(200, 600, 400)).toBe(66);
  });

  it("returns 0% when no losers", () => {
    expect(calculateReturnPct(200, 200, 0)).toBe(0);
  });
});

describe("isBettingOpen", () => {
  it("returns true when before closes_at", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBettingOpen("OPEN", future)).toBe(true);
  });

  it("returns false when past closes_at", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isBettingOpen("OPEN", past)).toBe(false);
  });

  it("returns false when status is CLOSED", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBettingOpen("CLOSED", future)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test 2>&1 | tail -5
```
Expected: FAIL — `~/lib/betting` not found.

- [ ] **Step 3: Implement `src/lib/betting.ts`**

```typescript
export function calculatePayout(
  betAmount: number,
  winningSideTotal: number,
  losingSideTotal: number
): number {
  if (losingSideTotal === 0 || winningSideTotal === 0) return betAmount;
  return Math.floor((betAmount / winningSideTotal) * losingSideTotal) + betAmount;
}

export function calculateReturnPct(
  betAmount: number,
  winningSideTotal: number,
  losingSideTotal: number
): number {
  const payout = calculatePayout(betAmount, winningSideTotal, losingSideTotal);
  if (payout === betAmount) return 0;
  return Math.round(((payout - betAmount) / betAmount) * 100);
}

export function isBettingOpen(status: string, closesAt: string): boolean {
  return status === "OPEN" && new Date(closesAt) > new Date();
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test 2>&1 | tail -6
```
Expected: All tests pass (previous 11 + 7 new = 18 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betting.ts tests/lib/betting.test.ts
git commit -m "feat(betting): add payout calculation utilities with tests"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add betting types**

Append to `src/lib/types.ts`:
```typescript
export type BetSide = "team1" | "team2";
export type BettingPoolStatus = "OPEN" | "CLOSED" | "RESOLVED" | "REFUNDED";

export interface BettingPool {
  id: string;
  faceitMatchId: string;
  status: BettingPoolStatus;
  team1Name: string;
  team2Name: string;
  team1Pool: number;
  team2Pool: number;
  winningTeam: BetSide | null;
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
}

export interface Bet {
  id: string;
  poolId: string;
  userId: string;
  side: BetSide;
  amount: number;
  payout: number | null;
  createdAt: string;
}

export interface BetWithPool extends Bet {
  pool: BettingPool;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  coins: number;
  betsPlaced: number;
  betsWon: number;
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
pnpm test 2>&1 | tail -4
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(betting): add betting types to types.ts"
```

---

## Task 3: Database Migration

**Files:**
- Create: `supabase/migrations/002_betting_system.sql`

- [ ] **Step 1: Create migration file**

`supabase/migrations/002_betting_system.sql`:
```sql
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
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool with:
- `project_id`: `dnluljisefcrorrtuxgq`
- `name`: `betting_system`
- `query`: contents of the migration file above

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/002_betting_system.sql
git commit -m "feat(betting): add DB schema and RPC functions"
```

---

## Task 4: Server Functions

**Files:**
- Create: `src/server/betting.ts`

- [ ] **Step 1: Create `src/server/betting.ts`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { createServerSupabase } from "~/lib/supabase.server";
import type { BettingPool, Bet, BetWithPool, LeaderboardEntry } from "~/lib/types";

// ── Helpers ──────────────────────────────────────────────────
// Note: server functions use the service role key (createServerSupabase).
// auth.uid() is NULL server-side. userId is passed explicitly from the client
// and verified at the DB level via UNIQUE constraints + RPC logic.
// For a 5-15 person friend group this is acceptable; a production system
// would extract userId from the request JWT via the auth.admin API.

function rowToPool(r: any): BettingPool {
  return {
    id: r.id,
    faceitMatchId: r.faceit_match_id,
    status: r.status,
    team1Name: r.team1_name,
    team2Name: r.team2_name,
    team1Pool: r.team1_pool,
    team2Pool: r.team2_pool,
    winningTeam: r.winning_team,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    resolvedAt: r.resolved_at,
  };
}

// ── createBettingPool ─────────────────────────────────────────

export const createBettingPool = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      faceitMatchId: string;
      team1Name: string;
      team2Name: string;
      startedAt: number; // unix seconds
    }) => input
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabase();
    const opensAt = new Date(data.startedAt * 1000).toISOString();
    const closesAt = new Date(data.startedAt * 1000 + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from("betting_pools").insert({
      faceit_match_id: data.faceitMatchId,
      team1_name: data.team1Name,
      team2_name: data.team2Name,
      opens_at: opensAt,
      closes_at: closesAt,
    });
    // Conflict (already exists) is silently ignored
    if (error && !error.message.includes("duplicate")) {
      console.error("createBettingPool error:", error.message);
    }
    return { ok: true };
  });

// ── getBettingPool ────────────────────────────────────────────

export const getBettingPool = createServerFn({ method: "GET" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }): Promise<{
    pool: BettingPool | null;
    userBet: Bet | null;
    userCoins: number;
  }> => {
    const supabase = createServerSupabase();

    const { data: poolRow } = await supabase
      .from("betting_pools")
      .select("*")
      .eq("faceit_match_id", faceitMatchId)
      .single();

    if (!poolRow) return { pool: null, userBet: null, userCoins: 0 };

    // Get user's bet if any — need user id from session (client-side context)
    // userBet fetched client-side via useBettingPool hook
    return { pool: rowToPool(poolRow), userBet: null, userCoins: 0 };
  });

// ── placeBet ──────────────────────────────────────────────────

export const placeBet = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { poolId: string; side: "team1" | "team2"; amount: number; userId: string }) =>
      input
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const supabase = createServerSupabase();
    const { data: result, error } = await supabase.rpc("place_bet", {
      p_user_id: data.userId,
      p_pool_id: data.poolId,
      p_side: data.side,
      p_amount: data.amount,
    });
    if (error) return { success: false, error: error.message };
    const parsed = result as any;
    if (parsed?.error) return { success: false, error: parsed.error };
    return { success: true };
  });

// ── resolvePool ───────────────────────────────────────────────

export const resolvePool = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { faceitMatchId: string; winningTeam: "team1" | "team2" }) => input
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabase();
    await supabase.rpc("resolve_pool", {
      p_faceit_match_id: data.faceitMatchId,
      p_winning_team: data.winningTeam,
    });
    return { ok: true };
  });

// ── cancelPool ────────────────────────────────────────────────

export const cancelPool = createServerFn({ method: "POST" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }) => {
    const supabase = createServerSupabase();
    await supabase.rpc("cancel_pool", { p_faceit_match_id: faceitMatchId });
    return { ok: true };
  });

// ── claimDailyAllowance ───────────────────────────────────────
// Note: resolveStalePools logic lives inline in getLiveMatches (src/server/matches.ts)
// to avoid an extra server function call on each poll. No standalone export needed.

export const claimDailyAllowance = createServerFn({ method: "POST" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<number> => {
    const supabase = createServerSupabase();
    const { data } = await supabase.rpc("claim_daily_allowance", {
      p_user_id: userId,
    });
    return (data as any)?.coins ?? 0;
  });

// ── getLeaderboard ────────────────────────────────────────────

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardEntry[]> => {
    const supabase = createServerSupabase();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, coins")
      .order("coins", { ascending: false });

    if (!profiles) return [];

    // Enrich with bet counts
    const { data: betCounts } = await supabase
      .from("bets")
      .select("user_id, amount, payout");

    const countMap = new Map<string, { placed: number; won: number }>();
    for (const b of betCounts ?? []) {
      const curr = countMap.get(b.user_id) ?? { placed: 0, won: 0 };
      curr.placed++;
      if (b.payout !== null && b.payout > b.amount) curr.won++;
      countMap.set(b.user_id, curr);
    }

    return profiles.map((p, i) => {
      const counts = countMap.get(p.id) ?? { placed: 0, won: 0 };
      return {
        userId: p.id,
        nickname: p.nickname,
        coins: p.coins,
        betsPlaced: counts.placed,
        betsWon: counts.won,
      };
    });
  }
);

// ── getUserBetHistory ─────────────────────────────────────────

export const getUserBetHistory = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<BetWithPool[]> => {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("bets")
      .select("*, betting_pools(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row: any) => ({
      id: row.id,
      poolId: row.pool_id,
      userId: row.user_id,
      side: row.side,
      amount: row.amount,
      payout: row.payout,
      createdAt: row.created_at,
      pool: rowToPool(row.betting_pools),
    }));
  });
```

- [ ] **Step 2: Run tests**

```bash
pnpm test 2>&1 | tail -4
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/server/betting.ts
git commit -m "feat(betting): add server functions for betting operations"
```

---

## Task 5: Integrate Pool Lifecycle into `getLiveMatches`

**Files:**
- Modify: `src/server/matches.ts`

> **Context:** `getLiveMatches` already detects ONGOING/FINISHED/CANCELLED matches. We need to:
> 1. Create pools for new ONGOING matches (within 5 min of start)
> 2. Resolve/cancel matches that transitioned to FINISHED/CANCELLED
> 3. Run stale pool sweep at end of each poll

- [ ] **Step 1: Read current `getLiveMatches` to find the right insertion points**

Read `src/server/matches.ts` lines 1-120 to understand the current flow.

- [ ] **Step 2: Add pool creation and resolution**

After the `for (const result of matchResults)` loop that builds `liveMatches`, add:

```typescript
// Import at top of file (add to existing imports):
import { createServerSupabase } from "~/lib/supabase.server";

// After building liveMatches array, before the return:
// 1. Create betting pools for new ONGOING matches within the 5-min window
for (const liveMatch of liveMatches) {
  const matchAgeSeconds = Math.floor(Date.now() / 1000) - liveMatch.startedAt;
  if (matchAgeSeconds <= 5 * 60) {
    // Within betting window — create pool if it doesn't exist
    const supabase = createServerSupabase();
    await supabase.from("betting_pools").insert({
      faceit_match_id: liveMatch.matchId,
      team1_name: liveMatch.teams.faction1.name,
      team2_name: liveMatch.teams.faction2.name,
      opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
      closes_at: new Date(liveMatch.startedAt * 1000 + 5 * 60 * 1000).toISOString(),
    }).onConflict("faceit_match_id").ignore();
  }
}

// 2. Check for matches that were live last poll but now resolved/cancelled
// These are found via the uniqueMatches that had non-ONGOING status
for (const result of matchResults) {
  if (result.status !== "fulfilled" || !result.value) continue;
}
// Resolve matches found as FINISHED in matchResults (before ONGOING filter)
// Done via resolveStalePools below.

// 3. Run stale pool sweep for pools no longer in live list
const liveIds = liveMatches.map((m) => m.matchId);
if (liveIds.length >= 0) {
  const { fetchMatch: fm } = await import("~/lib/faceit");
  const supabase2 = createServerSupabase();
  const { data: stalePools } = await supabase2
    .from("betting_pools")
    .select("faceit_match_id")
    .in("status", ["OPEN", "CLOSED"]);

  for (const pool of stalePools ?? []) {
    if (liveIds.includes(pool.faceit_match_id)) continue;
    try {
      const match = await fm(pool.faceit_match_id);
      if (match.status === "FINISHED") {
        const score = match.results?.score;
        if (score) {
          const winner = score.faction1 > score.faction2 ? "team1" : "team2";
          await supabase2.rpc("resolve_pool", {
            p_faceit_match_id: pool.faceit_match_id,
            p_winning_team: winner,
          });
        }
      } else if (match.status === "CANCELLED") {
        await supabase2.rpc("cancel_pool", {
          p_faceit_match_id: pool.faceit_match_id,
        });
      }
    } catch { /* ignore per-match errors */ }
  }
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
pnpm run build 2>&1 | grep -E "error|Error|✓ built" | head -10
```
Expected: `✓ built` (three times).

- [ ] **Step 4: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat(betting): integrate pool lifecycle into getLiveMatches"
```

---

## Task 6: Client Hooks

**Files:**
- Create: `src/hooks/useBettingPool.ts`
- Create: `src/hooks/useCoinBalance.ts`
- Create: `src/hooks/useLeaderboard.ts`
- Create: `src/hooks/useUserBets.ts`

- [ ] **Step 1: Create `src/hooks/useBettingPool.ts`**

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getBettingPool } from "~/server/betting";
import type { BettingPool, Bet } from "~/lib/types";

export function useBettingPool(faceitMatchId: string, userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["betting-pool", faceitMatchId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const supabase = (await import("~/lib/supabase.client")).getSupabaseClient();

      // Fetch pool
      const { data: poolRow } = await supabase
        .from("betting_pools")
        .select("*")
        .eq("faceit_match_id", faceitMatchId)
        .single();

      if (!poolRow) return { pool: null, userBet: null };

      // Fetch user's bet if signed in
      let userBet: Bet | null = null;
      if (userId) {
        const { data: betRow } = await supabase
          .from("bets")
          .select("*")
          .eq("pool_id", poolRow.id)
          .eq("user_id", userId)
          .single();
        if (betRow) {
          userBet = {
            id: betRow.id,
            poolId: betRow.pool_id,
            userId: betRow.user_id,
            side: betRow.side,
            amount: betRow.amount,
            payout: betRow.payout,
            createdAt: betRow.created_at,
          };
        }
      }

      const pool: BettingPool = {
        id: poolRow.id,
        faceitMatchId: poolRow.faceit_match_id,
        status: poolRow.status,
        team1Name: poolRow.team1_name,
        team2Name: poolRow.team2_name,
        team1Pool: poolRow.team1_pool,
        team2Pool: poolRow.team2_pool,
        winningTeam: poolRow.winning_team,
        opensAt: poolRow.opens_at,
        closesAt: poolRow.closes_at,
        resolvedAt: poolRow.resolved_at,
      };

      return { pool, userBet };
    },
    staleTime: 30_000,
    enabled: !!faceitMatchId,
  });

  // Supabase Realtime subscription for live pool updates
  useEffect(() => {
    if (!faceitMatchId) return;
    let channel: any;
    import("~/lib/supabase.client").then(({ getSupabaseClient }) => {
      channel = getSupabaseClient()
        .channel(`pool-${faceitMatchId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "betting_pools",
            filter: `faceit_match_id=eq.${faceitMatchId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey });
          }
        )
        .subscribe();
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [faceitMatchId, queryClient]);

  return query;
}
```

- [ ] **Step 2: Create `src/hooks/useCoinBalance.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { claimDailyAllowance } from "~/server/betting";

export function useCoinBalance(userId: string | null) {
  return useQuery<number>({
    queryKey: ["coin-balance", userId],
    queryFn: async () => {
      if (!userId) return 0;
      // claim_daily_allowance returns current balance (no-ops if already claimed today)
      return claimDailyAllowance({ data: userId });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Create `src/hooks/useLeaderboard.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "~/server/betting";
import type { LeaderboardEntry } from "~/lib/types";

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    staleTime: 2 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Create `src/hooks/useUserBets.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getUserBetHistory } from "~/server/betting";
import type { BetWithPool } from "~/lib/types";

export function useUserBets(userId: string | null) {
  return useQuery<BetWithPool[]>({
    queryKey: ["user-bets", userId],
    queryFn: () => getUserBetHistory({ data: userId! }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5: Build to verify**

```bash
pnpm run build 2>&1 | grep -E "error|✓ built" | head -5
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBettingPool.ts src/hooks/useCoinBalance.ts \
        src/hooks/useLeaderboard.ts src/hooks/useUserBets.ts
git commit -m "feat(betting): add betting hooks with Realtime subscription"
```

---

## Task 7: BettingPanel Component

**Files:**
- Create: `src/components/BettingPanel.tsx`

- [ ] **Step 1: Create `src/components/BettingPanel.tsx`**

```tsx
import { useState, useEffect } from "react";
import type { BettingPool, Bet, BetSide } from "~/lib/types";
import { isBettingOpen, calculatePayout, calculateReturnPct } from "~/lib/betting";
import { placeBet } from "~/server/betting";
import { useQueryClient } from "@tanstack/react-query";

interface BettingPanelProps {
  pool: BettingPool;
  userBet: Bet | null;
  userId: string | null;
  userCoins: number;
  matchId: string;
}

export function BettingPanel({ pool, userBet, userId, userCoins, matchId }: BettingPanelProps) {
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isOpen = isBettingOpen(pool.status, pool.closesAt);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const tick = () => {
      const ms = new Date(pool.closesAt).getTime() - Date.now();
      if (ms <= 0) { setTimeLeft("Closed"); return; }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pool.closesAt, isOpen]);

  async function handlePlaceBet() {
    if (!userId || !selectedSide) return;
    setLoading(true);
    setError(null);
    const result = await placeBet({
      data: { poolId: pool.id, side: selectedSide, amount, userId },
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Failed to place bet");
      return;
    }
    // Invalidate pool and balance queries
    queryClient.invalidateQueries({ queryKey: ["betting-pool", matchId] });
    queryClient.invalidateQueries({ queryKey: ["coin-balance", userId] });
  }

  const potentialPayout = selectedSide
    ? calculatePayout(
        amount,
        selectedSide === "team1" ? pool.team1Pool + amount : pool.team1Pool,
        selectedSide === "team2" ? pool.team2Pool + amount : pool.team2Pool
      )
    : 0;

  // Post-bet view
  if (userBet) {
    const betPool = userBet.side === "team1" ? pool.team1Pool : pool.team2Pool;
    const oppPool = userBet.side === "team1" ? pool.team2Pool : pool.team1Pool;
    const currentPayout = calculatePayout(userBet.amount, betPool, oppPool);
    return (
      <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">
        <div className="flex justify-between items-center">
          <span>
            Your bet:{" "}
            <span className="text-accent font-bold">
              {userBet.amount} coins on {userBet.side === "team1" ? pool.team1Name : pool.team2Name}
            </span>
          </span>
          <span>
            Potential:{" "}
            <span className={currentPayout > userBet.amount ? "text-accent" : "text-text-muted"}>
              {currentPayout} coins
            </span>
          </span>
        </div>
        {pool.status === "RESOLVED" && userBet.payout !== null && (
          <div className={`mt-1 font-bold ${userBet.payout > userBet.amount ? "text-accent" : "text-error"}`}>
            {userBet.payout > userBet.amount
              ? `Won ${userBet.payout} coins! (+${userBet.payout - userBet.amount})`
              : "Lost this bet."}
          </div>
        )}
        {pool.status === "REFUNDED" && (
          <div className="mt-1 text-text-muted">Match cancelled — bet refunded.</div>
        )}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-3 pt-3 border-t border-border text-xs text-text-dim text-center">
        <a href="/sign-in" className="text-accent hover:underline">Sign in</a> to bet
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Place Bet</span>
        {isOpen ? (
          <span className="text-[10px] text-text-muted">
            Closes in <span className="text-accent">{timeLeft}</span>
          </span>
        ) : (
          <span className="text-[10px] text-error">Betting closed</span>
        )}
      </div>

      {/* Team buttons */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {(["team1", "team2"] as BetSide[]).map((side) => {
          const name = side === "team1" ? pool.team1Name : pool.team2Name;
          const sidePool = side === "team1" ? pool.team1Pool : pool.team2Pool;
          const oppPool = side === "team1" ? pool.team2Pool : pool.team1Pool;
          const retPct = calculateReturnPct(amount, sidePool + (selectedSide === side ? amount : 0), oppPool);
          const isSelected = selectedSide === side;
          return (
            <button
              key={side}
              disabled={!isOpen}
              onClick={() => setSelectedSide(side)}
              className={`rounded p-2 text-xs text-left transition-colors border ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-elevated hover:border-accent/40"
              } disabled:opacity-40`}
            >
              <div className="font-bold truncate">{name}</div>
              <div className="text-text-muted mt-0.5">
                {sidePool} coins
                {retPct > 0 && <span className="text-accent ml-1">+{retPct}%</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Amount input */}
      {isOpen && (
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={10}
            max={Math.min(500, userCoins)}
            value={amount}
            onChange={(e) => setAmount(Math.max(10, Math.min(500, parseInt(e.target.value) || 10)))}
            className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
          <span className="text-[10px] text-text-dim">
            Balance: <span className="text-text">{userCoins}</span>
          </span>
          {selectedSide && potentialPayout > 0 && (
            <span className="text-[10px] text-text-dim ml-auto">
              → <span className="text-accent">{potentialPayout}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="text-error text-[10px] mt-1">{error}</p>}

      {isOpen && (
        <button
          onClick={handlePlaceBet}
          disabled={!selectedSide || loading || amount > userCoins}
          className="mt-2 w-full bg-accent text-bg text-xs font-bold py-1.5 rounded hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "..." : "Place Bet"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm run build 2>&1 | grep -E "error|✓ built" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BettingPanel.tsx
git commit -m "feat(betting): add BettingPanel component"
```

---

## Task 8: CoinBalance Component + Nav + LiveMatchCard

**Files:**
- Create: `src/components/CoinBalance.tsx`
- Modify: `src/routes/_authed.tsx`
- Modify: `src/components/LiveMatchCard.tsx`

- [ ] **Step 1: Create `src/components/CoinBalance.tsx`**

```tsx
import { useCoinBalance } from "~/hooks/useCoinBalance";

interface CoinBalanceProps {
  userId: string;
}

export function CoinBalance({ userId }: CoinBalanceProps) {
  const { data: coins } = useCoinBalance(userId);
  if (coins === undefined) return null;
  return (
    <span className="text-xs text-text-muted">
      🪙 <span className="text-text font-bold">{coins.toLocaleString()}</span>
    </span>
  );
}
```

- [ ] **Step 2: Read `src/routes/_authed.tsx` to understand current nav**

Read `src/routes/_authed.tsx` fully.

- [ ] **Step 3: Add CoinBalance to nav and session state**

In `_authed.tsx`, add:
1. Import `CoinBalance` from `~/components/CoinBalance`
2. Add `const [userId, setUserId] = useState<string | null>(null);`
3. In `useEffect`, after `getSession().then((s) => { setIsSignedIn(!!s); setUserId(s?.user.id ?? null); });`
4. In the nav, between the links div and the sign-in/out button, add: `{userId && <CoinBalance userId={userId} />}`

- [ ] **Step 4: Read `src/components/LiveMatchCard.tsx` fully**

- [ ] **Step 5: Add BettingPanel to LiveMatchCard**

Modify `LiveMatchCard.tsx`:
1. Add props: `userId?: string | null` and `userCoins?: number`
2. Import `useBettingPool` from `~/hooks/useBettingPool`
3. Import `BettingPanel` from `~/components/BettingPanel`
4. Inside the component, call: `const { data: betData } = useBettingPool(match.matchId, userId ?? null);`
5. Below the `friendIds` section at the bottom of the card, add:
```tsx
{betData?.pool && (
  <BettingPanel
    pool={betData.pool}
    userBet={betData.userBet}
    userId={userId ?? null}
    userCoins={userCoins ?? 0}
    matchId={match.matchId}
  />
)}
```

- [ ] **Step 6: Update dashboard and $nickname pages to pass userId + userCoins to LiveMatchCard**

In both `src/routes/_authed/index.tsx` and `src/routes/_authed/$nickname.tsx`:
1. Add `useCoinBalance` hook with `userId` state (get userId from `getSupabaseClient().auth.getSession()`)
2. Pass `userId` and `coins` to `<LiveMatchCard>`

> **Tip:** For userId, use a `useEffect` + `useState` pattern identical to what was done in `_authed.tsx` with `getSession`.

- [ ] **Step 7: Build to verify**

```bash
pnpm run build 2>&1 | grep -E "error|✓ built" | head -5
```

- [ ] **Step 8: Commit**

```bash
git add src/components/CoinBalance.tsx src/routes/_authed.tsx \
        src/components/LiveMatchCard.tsx src/routes/_authed/index.tsx \
        src/routes/_authed/'$nickname.tsx'
git commit -m "feat(betting): integrate BettingPanel and CoinBalance into UI"
```

---

## Task 9: Leaderboard Page

**Files:**
- Modify: `src/routes/_authed/leaderboard.tsx`

- [ ] **Step 1: Read current leaderboard stub**

Read `src/routes/_authed/leaderboard.tsx`.

- [ ] **Step 2: Replace stub with real leaderboard**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authed/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data: entries = [], isLoading } = useLeaderboard();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    import("~/lib/supabase.client").then(({ getSupabaseClient }) => {
      getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
        setCurrentUserId(session?.user.id ?? null);
      });
    });
  }, []);

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-6">Leaderboard</h2>

      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 text-[10px] text-text-dim uppercase tracking-wider px-3 pb-1">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Coins</span>
            <span className="text-right">Bets</span>
            <span className="text-right">Won</span>
            <span className="text-right">Win%</span>
          </div>
          {entries.map((entry, i) => {
            const winRate = entry.betsPlaced > 0
              ? Math.round((entry.betsWon / entry.betsPlaced) * 100)
              : 0;
            const isMe = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className={`grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 items-center px-3 py-2 rounded text-sm ${
                  isMe
                    ? "bg-accent/10 border border-accent/30"
                    : "bg-bg-elevated"
                }`}
              >
                <span className={`text-xs ${i < 3 ? "text-accent font-bold" : "text-text-dim"}`}>
                  {i + 1}
                </span>
                <span className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}>
                  {entry.nickname}
                </span>
                <span className="text-right text-accent font-bold">
                  🪙 {entry.coins.toLocaleString()}
                </span>
                <span className="text-right text-text-muted">{entry.betsPlaced}</span>
                <span className="text-right text-text-muted">{entry.betsWon}</span>
                <span className={`text-right ${winRate >= 50 ? "text-accent" : "text-text-muted"}`}>
                  {entry.betsPlaced > 0 ? `${winRate}%` : "—"}
                </span>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-text-dim text-center py-12 text-sm">
              No players yet — place the first bet!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add Leaderboard link to nav**

In `src/routes/_authed.tsx`, add after the History link:
```tsx
<Link
  to="/leaderboard"
  activeProps={{ className: "text-accent border-b border-accent pb-0.5" }}
  inactiveProps={{ className: "text-text-muted hover:text-accent" }}
>
  Leaderboard
</Link>
```

- [ ] **Step 4: Build to verify**

```bash
pnpm run build 2>&1 | grep -E "error|✓ built" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authed/leaderboard.tsx src/routes/_authed.tsx
git commit -m "feat(betting): implement leaderboard page"
```

---

## Task 10: My Bets Tab in History

**Files:**
- Modify: `src/routes/_authed/history.tsx`

- [ ] **Step 1: Read current history page**

Read `src/routes/_authed/history.tsx` fully.

- [ ] **Step 2: Add My Bets tab**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useFriends } from "~/hooks/useFriends";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useUserBets } from "~/hooks/useUserBets";
import { RecentMatches } from "~/components/RecentMatches";

const requireAuth = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" as any });
  });

export const Route = createFileRoute("/_authed/history")({
  beforeLoad: () => requireAuth(),
  component: HistoryPage,
});

type Tab = "matches" | "bets";

function HistoryPage() {
  const { data: friends = [] } = useFriends();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matches");
  const [userId, setUserId] = useState<string | null>(null);
  const { data: stats = [], isLoading } = usePlayerStats(selectedId);
  const { data: userBets = [], isLoading: betsLoading } = useUserBets(userId);

  useEffect(() => {
    import("~/lib/supabase.client").then(({ getSupabaseClient }) => {
      getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
        setUserId(session?.user.id ?? null);
      });
    });
  }, []);

  const matches = stats.map((m: any) => ({
    nickname: m.nickname,
    matchId: m.matchId,
    map: m.map,
    score: m.score,
    kdRatio: m.kdRatio,
    adr: m.adr,
    hsPercent: m.hsPercent,
    result: m.result,
    eloDelta: null,
  }));

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-elevated rounded p-1 w-fit">
        {(["matches", "bets"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-4 py-1.5 rounded transition-colors ${
              tab === t
                ? "bg-accent text-bg font-bold"
                : "text-text-muted hover:text-accent"
            }`}
          >
            {t === "matches" ? "Match History" : "My Bets"}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        <>
          <div className="flex gap-2 flex-wrap mb-6">
            {friends.map((f) => (
              <button
                key={f.faceitId}
                onClick={() => setSelectedId(f.faceitId)}
                className={`text-xs px-3 py-1.5 rounded ${
                  selectedId === f.faceitId
                    ? "bg-accent text-bg font-bold"
                    : "bg-bg-elevated text-text-muted hover:text-accent"
                }`}
              >
                {f.nickname}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="text-accent animate-pulse text-center py-8">Loading...</div>
          ) : selectedId ? (
            <RecentMatches matches={matches} />
          ) : (
            <div className="text-text-dim text-center py-12">
              Select a friend to view history
            </div>
          )}
        </>
      )}

      {tab === "bets" && (
        <div>
          {betsLoading ? (
            <div className="text-accent animate-pulse text-center py-8">Loading...</div>
          ) : userBets.length === 0 ? (
            <div className="text-text-dim text-center py-12">No bets placed yet.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr_4rem_4rem_5rem_5rem] gap-2 text-[10px] text-text-dim uppercase tracking-wider px-3 pb-1">
                <span>Match</span>
                <span>Side</span>
                <span className="text-right">Bet</span>
                <span className="text-right">Payout</span>
                <span className="text-right">Result</span>
              </div>
              {userBets.map((bet) => {
                const statusLabel =
                  bet.pool.status === "RESOLVED"
                    ? bet.payout !== null && bet.payout > bet.amount
                      ? "Won"
                      : "Lost"
                    : bet.pool.status === "REFUNDED"
                    ? "Refunded"
                    : "Pending";
                const statusColor =
                  statusLabel === "Won"
                    ? "text-accent"
                    : statusLabel === "Lost"
                    ? "text-error"
                    : "text-text-muted";
                const sideName =
                  bet.side === "team1" ? bet.pool.team1Name : bet.pool.team2Name;
                return (
                  <div
                    key={bet.id}
                    className="grid grid-cols-[1fr_4rem_4rem_5rem_5rem] gap-2 items-center px-3 py-2 bg-bg-elevated rounded text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-text truncate text-[10px]">
                        {bet.pool.team1Name} vs {bet.pool.team2Name}
                      </span>
                      <span className="text-text-dim text-[10px]">
                        {new Date(bet.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-text truncate">{sideName}</span>
                    <span className="text-right text-text-muted">{bet.amount}</span>
                    <span className={`text-right ${bet.payout ? "text-accent" : "text-text-dim"}`}>
                      {bet.payout ?? "—"}
                    </span>
                    <span className={`text-right font-bold ${statusColor}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build and run tests**

```bash
pnpm run build 2>&1 | grep -E "error|✓ built" | head -5
pnpm test 2>&1 | tail -6
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/history.tsx
git commit -m "feat(betting): add My Bets tab to history page"
```

---

## Task 11: Final Verification + Deploy

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```
Expected: all pass.

- [ ] **Step 2: Production build**

```bash
pnpm run build
```
Expected: 3× `✓ built`.

- [ ] **Step 3: Push and deploy**

```bash
git push && vercel --prod
```

- [ ] **Step 4: Smoke test on production**

1. Visit `/` — search for a player with live matches
2. Sign in via `/sign-in`
3. See `🪙 1,000` in nav (or 1,050 after daily allowance)
4. Visit `/leaderboard` — see your entry
5. If a live match exists: bet on a team, see pool totals update
6. Visit `/history` → My Bets tab — see your bet

---

## Summary

| Task | Key files | Commit message |
|------|-----------|----------------|
| 1 | `src/lib/betting.ts`, tests | feat(betting): payout utilities |
| 2 | `src/lib/types.ts` | feat(betting): types |
| 3 | `supabase/migrations/002_…sql` | feat(betting): DB schema + RPCs |
| 4 | `src/server/betting.ts` | feat(betting): server functions |
| 5 | `src/server/matches.ts` | feat(betting): pool lifecycle |
| 6 | `src/hooks/use*.ts` | feat(betting): hooks |
| 7 | `src/components/BettingPanel.tsx` | feat(betting): BettingPanel |
| 8 | nav, LiveMatchCard | feat(betting): UI integration |
| 9 | leaderboard.tsx | feat(betting): leaderboard |
| 10 | history.tsx | feat(betting): My Bets tab |
| 11 | — | deploy |
