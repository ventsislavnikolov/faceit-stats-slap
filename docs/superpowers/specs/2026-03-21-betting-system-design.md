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
| Daily allowance | +50 coins/day (claimed on any authenticated page load) |
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

CREATE INDEX idx_betting_pools_status ON betting_pools(status);

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

CREATE INDEX idx_bets_pool_id ON bets(pool_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);

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
- `bets`: users can SELECT all (to see pool totals); only service role can INSERT/UPDATE (via RPCs that receive `p_user_id` explicitly — see note below)
- `coin_transactions`: users can SELECT their own rows only
- `profiles.coins`: users can SELECT all (for leaderboard); only service role can UPDATE

> **Note on auth.uid() vs service key:** Server functions use `createServerSupabase()` (service role key), which means `auth.uid()` is NULL inside RPCs called from the server. All user-context RPCs receive `p_user_id UUID` as an explicit parameter. The server function verifies the current session and passes the authenticated user's ID. RLS enforcement is done by the server function layer, not inside the RPC itself.

---

## Architecture

### Pool lifecycle

```
Match ONGOING detected (within 5 min of started_at)
  → getLiveMatches upserts betting_pool row (INSERT ... ON CONFLICT DO NOTHING)
  → closes_at = started_at + 5 min

Betting window open
  → signed-in users see BettingPanel on LiveMatchCard
  → countdown timer in UI

closes_at reached
  → UI shows "Betting closed — waiting for result"
  → server rejects any further bets (pool status check in RPC)

Match FINISHED detected by getLiveMatches
  → calls resolve_pool RPC (idempotent)

Match CANCELLED detected by getLiveMatches
  → calls cancel_pool RPC (idempotent)

Fallback sweep (on every poll)
  → query betting_pools with status OPEN or CLOSED whose
    faceit_match_id is not in the current live match list
  → fetch each match's final status from FACEIT API directly
  → call resolve_pool or cancel_pool accordingly
  → prevents pools getting permanently stuck if polling misses
    the FINISHED/CANCELLED transition
```

### Supabase RPC functions

**`place_bet(p_user_id, p_pool_id, p_side, p_amount)`**
Atomic transaction using row-level locks to prevent race conditions:
1. `SELECT id, status, closes_at FROM betting_pools WHERE id = p_pool_id FOR UPDATE` — lock the pool row; error if status ≠ 'OPEN' or now() ≥ closes_at
2. `SELECT id FROM bets WHERE pool_id = p_pool_id AND user_id = p_user_id` — error if exists
3. `SELECT coins FROM profiles WHERE id = p_user_id FOR UPDATE` — lock profile row; error if coins < p_amount
4. `UPDATE profiles SET coins = coins - p_amount WHERE id = p_user_id`
5. `INSERT INTO bets (pool_id, user_id, side, amount) VALUES (...)`
6. `UPDATE betting_pools SET team1_pool = team1_pool + p_amount WHERE id = p_pool_id` (or team2_pool) — atomic increment, no lost-update
7. `INSERT INTO coin_transactions (user_id, amount, reason, bet_id) VALUES (p_user_id, -p_amount, 'bet_placed', <new_bet_id>)`

**`resolve_pool(p_faceit_match_id, p_winning_team)`**
Atomic transaction:
1. `SELECT id, status FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE` — **idempotency check first**: if status already RESOLVED or REFUNDED, return immediately (no-op)
2. Fetch all bets for this pool
3. If no bets on losing side → **call the refund path**: for each bet, `SELECT coins FROM profiles WHERE id = bet.user_id FOR UPDATE`, then `UPDATE profiles SET coins = coins + bet.amount`, insert `coin_transactions` row (reason: 'bet_refunded'), `UPDATE bets SET payout = amount`, set `betting_pools.status = 'REFUNDED'` (not RESOLVED), return
4. Calculate each winner's payout: `floor((bet.amount / winning_side_total) × losing_side_total + bet.amount)`
5. For each winner: `SELECT coins FROM profiles WHERE id = bet.user_id FOR UPDATE`, then `UPDATE profiles SET coins = coins + payout WHERE id = bet.user_id`
6. `UPDATE bets SET payout = <calculated> WHERE id = bet.id` for each winner
7. Insert `coin_transactions` rows for each winner (reason: 'bet_won')
8. `UPDATE betting_pools SET status = 'RESOLVED', winning_team = p_winning_team, resolved_at = now()`

**`cancel_pool(p_faceit_match_id)`**
Atomic transaction:
1. `SELECT id, status FROM betting_pools WHERE faceit_match_id = p_faceit_match_id FOR UPDATE` — if already RESOLVED or REFUNDED, return (no-op)
2. Fetch all bets
3. For each bet: `SELECT coins FROM profiles WHERE id = bet.user_id FOR UPDATE`, then `UPDATE profiles SET coins = coins + bet.amount WHERE id = bet.user_id`
4. `UPDATE bets SET payout = amount WHERE id = bet.id` (refund = original amount)
5. Insert `coin_transactions` rows (reason: 'bet_refunded')
6. `UPDATE betting_pools SET status = 'REFUNDED', resolved_at = now()`

**`claim_daily_allowance(p_user_id)`**
1. `SELECT last_daily_at FROM profiles WHERE id = p_user_id FOR UPDATE`
2. If `last_daily_at >= current_date` (UTC), return current balance (no-op)
3. `UPDATE profiles SET coins = coins + 50, last_daily_at = now() WHERE id = p_user_id`
4. `INSERT INTO coin_transactions (user_id, amount, reason) VALUES (p_user_id, 50, 'daily_allowance')`
5. Returns new balance

### Realtime

Subscribe to `betting_pools` table changes (filter: `faceit_match_id=eq.{matchId}`) on the match card component. When `team1_pool` or `team2_pool` updates, re-render odds and potential payout instantly for all viewers.

### Server functions (createServerFn)

- `createBettingPool(liveMatch)` — called from `getLiveMatches`; uses `INSERT ... ON CONFLICT (faceit_match_id) DO NOTHING`, treats no-op as success
- `placeBet(poolId, side, amount)` — gets current user from session, calls `place_bet(userId, poolId, side, amount)` RPC
- `getBettingPool(faceitMatchId)` — fetch pool + current user's bet
- `resolveStalePools(currentLiveMatchIds)` — fallback sweep: finds OPEN/CLOSED pools not in the live list, fetches FACEIT status, resolves or cancels
- `getLeaderboard()` — fetch all profiles ordered by coins DESC
- `getUserBetHistory(userId)` — fetch bets joined with pools/matches

---

## UI Components

### Nav
- Coin balance shown for signed-in users: `🪙 1,240`
- Subtle animation when daily allowance is claimed
- `claim_daily_allowance` called on every authenticated page load (no-ops silently after first call of the day)

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
- Note: shows last-claimed balance; allowance claimed on page load

### History page — My Bets tab
- Extend existing `/history` with a "My Bets" tab
- Columns: match (map + date), your side, amount, payout, result (W / L / Refunded / Pending)

---

## Error handling

| Scenario | Handling |
|----------|----------|
| Bet placed after window closes | RPC returns error, UI shows "Betting is closed" |
| Insufficient coins | RPC returns error, UI shows "Not enough coins" |
| Match resolves with no losing bets | Full refund via cancel_pool, all users notified |
| Duplicate bet attempt | DB unique constraint + RPC check, UI shows "Already placed" |
| Match CANCELLED | `cancel_pool` RPC called by `getLiveMatches` or fallback sweep |
| Polling misses FINISHED/CANCELLED | Fallback sweep on each poll resolves stale pools |
| Daily allowance already claimed | RPC no-ops silently, returns current balance |
| Service role key / auth.uid() | All RPCs receive explicit `p_user_id`; session verified in server function layer |

---

## Out of scope (Phase 3)

- Admin panel to manually adjust balances
- Notifications (email/push) on match resolve
- Bet history for other users (only your own)
- Live chat / reactions on match card
