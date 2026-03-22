# RWS Demo Parser — Design Spec

## Overview

Add per-match RWS (Round Win Share) calculation by downloading and parsing CS2 demo files from FACEIT. Includes a new match detail page and rate-limited demo parsing.

## Prerequisite: Vercel Feasibility POC

Before any implementation, deploy a minimal test function that:
1. Imports `demoparser2`
2. Downloads a real FACEIT demo (~100MB .dem.zst)
3. Decompresses with `fzstd`
4. Parses damage events

**If this fails** (OOM, native binary build fails, timeout), the architecture changes to an external worker (Fly.io/Railway) with the TanStack app polling for results. The rest of this spec assumes Vercel works.

Key constraints:
- Vercel Pro: 3GB RAM, 800s maxDuration
- `demoparser2` uses Rust native bindings, requires full file in memory
- Demo files: 50-150MB compressed, 200-500MB decompressed
- `calculateMatchRws` must be code-split into its own Vercel function (not bundled into main SSR)

## New Route: `/match/$matchId`

Match detail page showing full scoreboard for both teams with all available stats. RWS displayed when cached, or a "Calculate RWS" button when not yet computed.

### Navigation

Links to this page from:
- History match rows
- Live match cards (post-match)
- Leaderboard (future: click player → recent matches → click match)

## RWS Calculation Flow

1. User opens `/match/$matchId`
2. Page loads match stats from Supabase cache (or fetches from FACEIT API + caches)
3. Check `match_rws` table — if RWS exists for this match, display inline
4. If no cached RWS → show "Calculate RWS" button with remaining daily quota
5. On click:
   a. Fetch demo URL from FACEIT API, HEAD request to verify it's still downloadable
   b. If demo unavailable → show "Demo unavailable (expired)", do NOT consume quota
   c. Call `claim_rws_slot` Postgres RPC (atomic rate limit check + insert, see below)
   d. If rate limit exceeded → show "Limit reached"
   e. Check deduplication: acquire advisory lock `pg_try_advisory_lock(hashtext(matchId))`
   f. If lock not acquired → another user is already parsing this match; poll `match_rws` for results
   g. Trigger server function that:
      - Downloads `.dem.zst` from Backblaze CDN
      - Decompresses with zstd
      - Parses with `demoparser2` npm package
      - Extracts per-round damage, round winners, bomb plant/defuse events
      - Computes RWS per player using formula
      - Stores results in `match_rws` table
      - Releases advisory lock
   h. On parse failure: delete the `rws_calculations` row (refund the slot)
   i. Returns RWS data to client
6. UI shows RWS column in scoreboard

## RWS Formula

Each **won round** distributes **100 points** to the winning team. Losing team gets 0.

- **Normal round:** `player_RWS = (player_damage / team_damage) * 100`
- **Bomb plant/defuse round:** Planter/defuser gets **30 bonus**, remaining **70 by damage share**
- **Match RWS** = sum of per-round RWS / total rounds played

### Edge cases

- **Zero team damage in a won round** (e.g., time expiry, bomb explodes with no contact): distribute 100 points equally among alive players (20 each if all 5 alive)
- **Bomb round with zero team damage:** Planter/defuser gets 30, remaining 70 split equally among alive players
- **Dead players:** 0 RWS for that round (not excluded from denominators)

### Validation

Sum of 5 players' RWS = `(rounds_won / total_rounds) * 100`

## Rate Limiting

- **3 calculations per user per rolling 24 hours**
- Only fresh demo parsing counts — cached results are free
- UI shows: "Calculate RWS (2/3 remaining today)"
- When exhausted: button disabled, shows "Limit reached — resets in Xh"
- Rate limit check + insert is atomic via Postgres RPC (prevents race condition)
- Demo availability is verified BEFORE consuming a slot
- On parse failure, the slot is refunded (row deleted)

### Deduplication

If two users trigger RWS for the same match simultaneously:
- First user acquires advisory lock and parses
- Second user sees lock is held, polls `match_rws` for results instead
- Second user does NOT consume a rate limit slot

## DB Schema

### `match_rws` — cached RWS results

```sql
CREATE TABLE match_rws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT NOT NULL,
  faceit_player_id TEXT NOT NULL,
  nickname TEXT,
  team TEXT NOT NULL,  -- "faction1" or "faction2"
  rws NUMERIC(5,2) NOT NULL,
  damage_in_won_rounds INTEGER DEFAULT 0,
  team_damage_in_won_rounds INTEGER DEFAULT 0,
  bomb_plants INTEGER DEFAULT 0,
  bomb_defuses INTEGER DEFAULT 0,
  rounds_won INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(faceit_match_id, faceit_player_id)
);

ALTER TABLE match_rws ENABLE ROW LEVEL SECURITY;
-- Read: any authenticated user
CREATE POLICY "Authenticated users can read match_rws" ON match_rws
  FOR SELECT USING (auth.role() = 'authenticated');
-- Writes: service key only (server functions). No INSERT/UPDATE policy intentionally.
CREATE INDEX idx_match_rws_match ON match_rws(faceit_match_id);
```

### `rws_calculations` — rate limit tracking

```sql
CREATE TABLE rws_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  faceit_match_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rws_calculations ENABLE ROW LEVEL SECURITY;
-- Read: users can only see their own calculations
CREATE POLICY "Users can read own calculations" ON rws_calculations
  FOR SELECT USING (auth.uid() = user_id);
-- Writes: service key only (server functions). No INSERT policy intentionally.
CREATE INDEX idx_rws_calc_user_time ON rws_calculations(user_id, created_at DESC);
```

### Atomic rate limit RPC

```sql
CREATE OR REPLACE FUNCTION claim_rws_slot(p_user_id UUID, p_match_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  used_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO used_count
  FROM rws_calculations
  WHERE user_id = p_user_id
    AND created_at > now() - interval '24 hours'
  FOR UPDATE;

  IF used_count >= 3 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rws_calculations (user_id, faceit_match_id)
  VALUES (p_user_id, p_match_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## Dependencies (new npm packages)

- `demoparser2` — CS2 demo parser (Node.js native bindings)
- `fzstd` — zstd decompression in JS (or `@aspect/zstd` for native speed)

## Match Detail Page Layout

```
┌─────────────────────────────────────────┐
│ de_ancient    13 - 8    (7-6 / 5-3)    │
│ FACEIT EU 5v5 Queue                     │
├─────────────────────────────────────────┤
│ team_TibaBG (W)                         │
│ ┌───────────────────────────────────┐   │
│ │ # Player  ELO  RWS  K  D  A  ADR │   │
│ │ 1 soav..  1688 15.0 23 17 8 108  │   │
│ │ 2 TibaB.. 2107 13.8 20 12 10 104 │   │
│ │ ...                               │   │
│ └───────────────────────────────────┘   │
│                                         │
│ team_bbakkanimals (L)                   │
│ ┌───────────────────────────────────┐   │
│ │ # Player  ELO  RWS  K  D  A  ADR │   │
│ │ ...                               │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [Calculate RWS (2/3 remaining today)]   │
│ or                                      │
│ RWS column shown inline if cached       │
└─────────────────────────────────────────┘
```

## Server Functions

### `getMatchDetail(matchId: string)`
Fetch full match data + stats for both teams. Return all 42 player stats + team info. Cache in Supabase.

### `calculateMatchRws(matchId: string)`
Rate-limited (userId derived from server session, NOT client input). Download demo, parse, compute RWS, store in `match_rws`. Returns RWS data for all 10 players. Must be code-split into its own Vercel function with extended `maxDuration`.

### `getMatchRws(matchId: string)`
Check if RWS is cached for this match. Returns cached data or null.

### `getRwsQuota()`
Derives userId from server session. Count calculations in last 24h. Return `{ used: number, limit: 3, resetAt: string }`.

## Error Handling

- **Demo unavailable** (expired/404): show "Demo unavailable" — does NOT consume quota
- **Parse failure**: show error, refund quota slot (delete tracking row)
- **Timeout**: extended maxDuration in vercel.json for this function
- **Concurrent parse**: second request polls for results instead of re-parsing
- **demoparser2 build failure on Vercel**: fallback to external worker architecture (documented in POC section)

## Implementation Order

1. **POC**: Minimal Vercel function that downloads + parses one demo. Deploy and test.
2. **DB migration**: Create `match_rws`, `rws_calculations`, `claim_rws_slot` RPC
3. **Match detail page**: `/match/$matchId` route with full scoreboard (no RWS yet)
4. **RWS server function**: `calculateMatchRws` with rate limiting and dedup
5. **UI integration**: "Calculate RWS" button, quota display, RWS column in scoreboard
6. **Navigation**: Link history rows and match cards to `/match/$matchId`
