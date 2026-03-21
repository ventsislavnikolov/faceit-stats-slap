# FaceitFriendsLive — Betting System Design

## Overview

Virtual coin betting on live CS2 matches for authenticated users. Coins are fictional with no real-world value. The system is pari-mutuel: winners split the losers' pool proportionally to their bet size.

**Target users:** Small authenticated friend group (5–15 people).
**Stack:** Supabase PostgreSQL (RPC for atomicity), Supabase Realtime (live odds), TanStack Query (polling), TanStack Start server functions.

---

## Rules

| Rule | Value |
|------|-------|
| Starting balance | 1,000 coins |
| Daily allowance | +50 coins/day (claimed lazily on dashboard load) |
| Betting window | Opens when match detected ONGOING, closes 5 min after `started_at` |
| Min / Max bet | 10 / 500 coins per match |
| One bet per user per match | Enforced by DB unique constraint |
| If only one side has bets | Full refund to all bettors |
| Payout formula | `(your_bet / winning_side_total) × losing_side_total + your_bet` |

**Example:** You bet 200 on team1. Pool: 600 on team1, 400 on team2. Payout = `(200/600) × 400 + 200 = 333 coins`.

---

## Data Model

### Schema changes

```sql
-- Add to existing profiles table
ALTER TABLE profiles ADD COLUMN coins INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN last_daily_at TIMESTAMPTZ;

-- Betting pools: one per match
CREATE TABLE betting_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED | RESOLVED | REFUNDED
  team1_name      TEXT NOT NULL,
  team2_name      TEXT NOT NULL,
  team1_pool      INTEGER NOT NULL DEFAULT 0,
  team2_pool      INTEGER NOT NULL DEFAULT 0,
  winning_team    TEXT,                          -- 'team1' | 'team2' | null
  opens_at        TIMESTAMPTZ NOT NULL,
  closes_at       TIMESTAMPTZ NOT NULL,          -- opens_at + 5 minutes
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Individual bets
CREATE TABLE bets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id    UUID NOT NULL REFERENCES betting_pools(id),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  side       TEXT NOT NULL CHECK (side IN ('team1', 'team2')),
  amount     INTEGER NOT NULL CHECK (amount >= 10 AND amount <= 500),
  payout     INTEGER,                            -- null until resolved
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Coin transaction audit log
CREATE TABLE coin_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  amount     INTEGER NOT NULL,                   -- positive = gain, negative = spend
  reason     TEXT NOT NULL,                      -- 'bet_placed' | 'bet_won' | 'bet_refunded' | 'daily_allowance'
  bet_id     UUID REFERENCES bets(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS policies

- `betting_pools`: authenticated users can SELECT all; only service role can INSERT/UPDATE
- `bets`: users can SELECT all (to see pool totals); users can only INSERT their own bet; only service role can UPDATE (payouts)
- `coin_transactions`: users can SELECT their own rows only
- `profiles.coins`: users can SELECT all (for leaderboard); only service role can UPDATE

---

## Architecture

### Pool lifecycle

```
Match ONGOING detected (within 5 min of started_at)
  → getLiveMatches creates betting_pool row (OPEN)
  → closes_at = started_at + 5 min

Betting window open
  → signed-in users see BettingPanel on LiveMatchCard
  → countdown timer in UI

closes_at reached
  → UI shows "Betting closed — waiting for result"
  → server rejects any further bets

Match FINISHED detected
  → getLiveMatches calls resolve_pool RPC
  → winners credited, pool marked RESOLVED
  → if one side empty → REFUNDED
```

### Supabase RPC functions

**`place_bet(p_pool_id, p_side, p_amount)`**
Atomic transaction:
1. Check pool status = 'OPEN' and now() < closes_at
2. Check no existing bet for this user+pool
3. Check user.coins >= p_amount
4. Deduct coins from profiles
5. Insert bets row
6. Increment betting_pools.team1_pool or team2_pool
7. Insert coin_transactions row (reason: 'bet_placed', amount: -p_amount)

**`resolve_pool(p_faceit_match_id, p_winning_team)`**
Atomic transaction:
1. Fetch pool and all bets
2. If no bets on losing side → refund all, status = 'REFUNDED'
3. Else calculate each winner's payout, update bets.payout
4. Credit winners' profiles.coins
5. Insert coin_transactions rows (reason: 'bet_won' or 'bet_refunded')
6. Set pool status = 'RESOLVED', resolved_at = now()
7. Idempotent: no-op if already RESOLVED/REFUNDED

**`claim_daily_allowance()`**
1. Check profiles.last_daily_at < today (UTC)
2. Add 50 to profiles.coins
3. Set last_daily_at = now()
4. Insert coin_transactions row (reason: 'daily_allowance', amount: +50)
5. Returns new balance

### Realtime

Subscribe to `betting_pools` table changes (filter: `faceit_match_id=eq.{matchId}`) on the match card component. When `team1_pool` or `team2_pool` updates, re-render odds and potential payout instantly.

### Server functions (createServerFn)

- `createBettingPool(liveMatch)` — called from getLiveMatches when new ONGOING match has no pool yet
- `placeBet(poolId, side, amount)` — calls Supabase RPC place_bet
- `getBettingPool(faceitMatchId)` — fetch pool + current user's bet
- `getLeaderboard()` — fetch all profiles ordered by coins DESC
- `getUserBetHistory(userId)` — fetch bets joined with pools/matches

---

## UI Components

### Nav
- Coin balance shown for signed-in users: `🪙 1,240`
- Subtle animation when daily allowance claimed

### BettingPanel (inside LiveMatchCard)
- Two team buttons with pool totals and return % (e.g. "Team A · 600 coins · +40%")
- Amount input: number field, min 10 max 500, shows current balance
- "Place Bet" button — disabled when: pool closed, already bet, insufficient coins
- Countdown: `Betting closes in 3:24`
- Post-bet state: "You bet 200 on Team A · potential payout: 333 coins"
- Non-authenticated users see: "Sign in to bet"

### Leaderboard page (`/leaderboard`)
- Replaces current stub
- Table: rank, nickname, coin balance, bets placed, bets won, win rate
- Current user's row highlighted in accent colour

### History page — My Bets tab
- Extend existing `/history` with a "My Bets" tab
- Columns: match (map + date), your side, amount, payout, result (W / L / Refunded / Pending)

---

## Error handling

| Scenario | Handling |
|----------|----------|
| Bet placed after window closes | RPC returns error, UI shows "Betting is closed" |
| Insufficient coins | RPC returns error, UI shows "Not enough coins" |
| Match resolves with no losing bets | Full refund, all users notified |
| Duplicate bet attempt | DB unique constraint, RPC returns error |
| Match never resolves (cancelled) | Manual REFUNDED via admin or detected via CANCELLED status in FACEIT API |
| Daily allowance already claimed | RPC no-ops silently |

---

## Out of scope (Phase 3)

- Admin panel to manually adjust balances
- Notifications (email/push) on match resolve
- Bet history for other users (only your own)
- Live chat / reactions on match card
