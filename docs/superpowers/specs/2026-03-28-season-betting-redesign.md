# Season-Based Betting System Redesign

Replace the current pari-mutuel match betting system with a season-based competitive leaderboard where players start with 1000 coins, bet freely (including all-in), and compete for prizes.

## Core Concepts

- **Seasons**: time-bounded competitions with custom date ranges, created by admin (soavarice)
- **Two bet types**: match outcome bets (existing) + auto-generated player performance props
- **Pari-mutuel odds** for everything — winners split the losers' pool
- **Hard reset**: everyone starts at 1000 coins each season; no daily allowance
- **Go broke = sit out** until next season
- **One active season at a time**

## Database Schema

### New Tables

#### `seasons`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | e.g. "Season 1" |
| `starts_at` | TIMESTAMPTZ | |
| `ends_at` | TIMESTAMPTZ | |
| `created_by` | UUID FK `auth.users` | must be soavarice |
| `status` | TEXT | `upcoming \| active \| completed` DEFAULT `upcoming` |
| `prizes` | JSONB | `[{ place: 1, description: "AK-47 Redline" }]` |
| `created_at` | TIMESTAMPTZ | |

Partial unique index on `status = 'active'` — enforces one active season at a time.

#### `season_participants`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `season_id` | UUID FK `seasons` | |
| `user_id` | UUID FK `auth.users` | |
| `starting_coins` | INTEGER | DEFAULT 1000 |
| `coins` | INTEGER | DEFAULT 1000, mutable balance |
| `joined_at` | TIMESTAMPTZ | |

UNIQUE `(season_id, user_id)`. Auto-created when user places first bet in a season.

#### `prop_pools`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `season_id` | UUID FK `seasons` | |
| `faceit_match_id` | TEXT | |
| `player_id` | TEXT | FACEIT player ID |
| `player_nickname` | TEXT | |
| `stat_key` | TEXT | `kills \| kd \| adr` |
| `threshold` | NUMERIC | e.g. `22.5` |
| `description` | TEXT | e.g. "Flaw1esss 23+ kills" |
| `yes_pool` | INTEGER DEFAULT 0 | |
| `no_pool` | INTEGER DEFAULT 0 | |
| `outcome` | BOOLEAN | null until resolved |
| `status` | TEXT | `open \| closed \| resolved \| refunded` DEFAULT `open` |
| `opens_at` | TIMESTAMPTZ | |
| `closes_at` | TIMESTAMPTZ | |
| `resolved_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | |

### Modified Tables

#### `betting_pools`

- Add `season_id` UUID FK `seasons` (nullable for legacy pools)

#### `bets`

- Add `prop_pool_id` UUID FK `prop_pools` (nullable)
- Add CHECK: exactly one of `pool_id` or `prop_pool_id` is NOT NULL
- Remove amount CHECK 10-500, replace with CHECK `amount >= 1`
- Change unique constraint: partial unique index on `(pool_id, user_id) WHERE pool_id IS NOT NULL` for match bets only (one match bet per user per match, unlimited prop bets)

#### `profiles`

- `coins` column becomes unused (balance lives in `season_participants.coins`)
- Keep column to avoid breaking existing queries during migration

### Removed / Deprecated

- `coin_transactions` table — no longer written to
- `bet_audit_events` table — dropped for simplicity
- `claim_daily_allowance` RPC — removed entirely
- `last_daily_at` column on `profiles` — unused

### RPCs (Replace Existing)

#### `place_bet(p_user_id, p_season_id, p_pool_id, p_prop_pool_id, p_side, p_amount)`

- `p_side`: `team1 | team2` for match bets, `yes | no` for prop bets
- Exactly one of `p_pool_id` or `p_prop_pool_id` must be provided

1. Verify active season
2. Auto-join `season_participants` if not already joined (INSERT ON CONFLICT DO NOTHING, then SELECT FOR UPDATE)
3. Lock participant row, check balance >= amount
4. Deduct coins from `season_participants`
5. Insert `bets` row
6. Increment the appropriate side total on the pool/prop_pool

#### `resolve_pool(p_faceit_match_id, p_winning_team)`

Same pari-mutuel logic as today but credits `season_participants.coins` instead of `profiles.coins`.

#### `resolve_prop(p_prop_pool_id, p_outcome)`

1. Set `outcome` and `status = 'resolved'`
2. Pay out winning side (yes/no) using pari-mutuel formula against `season_participants.coins`
3. If one side has no bets, refund the other side

#### `cancel_pool(p_faceit_match_id)` / `cancel_prop(p_prop_pool_id)`

Refund all bettors to `season_participants.coins`.

## Prop Generation

### When a match goes live

During `getLiveMatches` polling, when a new ONGOING match is detected (same trigger as match pool creation):

1. For each tracked player in the match roster, look up their recent stats (last 20 matches from `match_player_stats`)
2. Generate 3 props per player:
   - **Kills**: threshold = `ceil(avgKills)` — e.g. avg 20.3 → "Flaw1esss 21+ kills"
   - **K/D**: threshold = player's avgKD rounded up to 1 decimal — e.g. avg 1.15 → "TibaBG 1.2+ K/D"
   - **ADR**: threshold = `ceil(avgADR)` — e.g. avg 78.4 → "soavarice 79+ ADR"
3. Insert `prop_pools` rows with same betting window as the match pool (5 min after match start)

### Only tracked players

Props are generated only for players in the tracked friends group who appear in the match roster. This keeps it relevant — betting on people you know.

### Typical volume

3 props per player x ~5 tracked players per match = ~15 props per match.

### Resolution

When a match finishes (same trigger as match pool resolution):

1. Fetch match stats from FACEIT API (already done for stat tracking)
2. For each `prop_pool` linked to that match:
   - Compare actual stat vs threshold
   - Call `resolve_prop` RPC
3. Props with no bets on either side get auto-cancelled

## Season Lifecycle

### Creating a season (admin only)

Admin check: hardcoded FACEIT ID for soavarice. On `/bets` page, admin sees "Create Season" button. Form fields:
- Name (text)
- Start date, end date (date pickers)
- Prizes (dynamic rows: place number + description text)

Season is created with `status = 'upcoming'`.

### State transitions

```
upcoming → active → completed
```

- **upcoming → active**: automatic when `now() >= starts_at`, checked on page load / poll
- **active → completed**: automatic when `now() >= ends_at`; matches in progress at season end are still resolved normally
- **No active season**: betting disabled globally, UI shows "No active season" with countdown to next upcoming season

### No overlapping seasons

Date range validation on creation. Only one `active` season at a time (enforced by partial unique index).

## UI Design

### /bets page structure

Tabs layout with season header:

1. **Season header** (always visible): season name, date range, status badge, your coin balance
2. **Tabs**: Leaderboard | Live Bets | My Bets | History

### Leaderboard tab

- Sorted by `season_participants.coins` DESC
- Columns: rank, player name, coins, bets placed, win rate
- Prizes section below the table
- During active season: live data
- After season ends: frozen final standings

### Live Bets tab

Individual self-contained bet cards:
- **Match outcome card**: two team buttons with pool totals and multipliers, amount input, BET + ALL IN buttons
- **Prop cards** (one per prop): player name + stat threshold, avg stat shown, YES/NO buttons with multipliers, own amount input + BET/ALL IN
- Each card operates independently — user can bet different amounts on different things
- 5-minute countdown timer on each card

### My Bets tab

Personal bet history for the current season. Shows match bets + prop bets with status (pending/won/lost/refunded), amounts, payouts.

### History tab (season archive)

Dropdown to select past completed seasons. Shows frozen leaderboard + prizes for each.

### CoinBalance in nav

Shows season coins from `season_participants` for active season. Shows "—" if no active season or user hasn't placed a bet yet.

### Admin: Create Season

Only visible to soavarice. Form to create a new season with name, dates, prizes. Shown on `/bets` when no active/upcoming season exists, or as a button in the season header.

## What Gets Removed

- `claim_daily_allowance` RPC and server function
- Auto-claim in `useCoinBalance` hook
- `last_daily_at` column on profiles
- `coin_transactions` writes
- `bet_audit_events` writes
- Fixed 10-coin bet amount
- One bet per match constraint (for props)
- `profiles.coins` mutations (column kept but unused)

## What Gets Changed

- `CoinBalance` component: reads from `season_participants` instead of `profiles`
- `BettingPanel`: expanded to show prop cards alongside match outcome
- `/bets` page: becomes season hub with Leaderboard/Live Bets/My Bets/History tabs
- Pool creation in `getLiveMatches`: also generates `prop_pools`
- Pool resolution: also resolves associated `prop_pools`
- `getLeaderboard`: queries `season_participants` filtered by active season

## What Stays the Same

- `betting_pools` table structure (just add `season_id`)
- `bets` table structure (extended with `prop_pool_id`)
- Pari-mutuel payout formula (`calculatePayout`)
- Supabase Realtime subscriptions for live odds
- 5-minute betting window
- Pool creation/resolution piggybacked into `getLiveMatches` polling

## Migration Strategy

Replace in-place. No parallel system. Steps:
1. New migration adding `seasons`, `season_participants`, `prop_pools` tables
2. Alter `betting_pools` to add `season_id`
3. Alter `bets` to add `prop_pool_id`, change constraints
4. Drop `claim_daily_allowance` RPC
5. Old bets/pools remain in tables (orphaned with null `season_id`) but are not displayed
