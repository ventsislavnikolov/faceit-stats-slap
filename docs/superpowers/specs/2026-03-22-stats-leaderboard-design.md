# Stats Leaderboard Design

**Date:** 2026-03-22
**Status:** Approved (v2 — corrected against codebase)

## Summary

Extend the `/leaderboard` page with a **Stats tab** that ranks all tracked friends (and the current user) by aggregated CS2 performance stats over a selectable window of last 20, 50, or 100 games. The existing betting leaderboard becomes the **Bets tab**.

---

## Navigation

No new routes. `/leaderboard` gains two tabs:

- **Stats** (first, default active)
- **Bets** (existing content, unchanged)

Note: existing `/leaderboard` currently renders betting content directly with no tabs. This is a behavior change — the betting content moves under a Bets tab.

---

## Stats Tab UI

### Filter
A pill toggle at the top of the tab: `20 | 50 | 100` games. Global — affects all rows simultaneously. Default: `20`.

### Table

| Column | Key | Notes |
|--------|-----|-------|
| # | rank | 1-indexed, sorted position |
| Player | nickname + ELO | ELO shown inline in muted text |
| GP | gamesPlayed | Actual games used — may be less than N if player has fewer career games |
| K/D | avgKd | **Default sort column**, descending, highlighted in orange |
| ADR | avgAdr | Average damage per round |
| WIN% | winRate | `wins / gamesPlayed × 100` |
| HS% | avgHsPercent | Average headshot percentage |
| K/R | avgKrRatio | Kills per round |

All column headers are clickable to re-sort (ascending/descending toggle). Sort state is local component state — no URL persistence needed.

### Visual treatment
- Top 3 rows: gold / silver / bronze rank number
- Current user's row (`MY_FACEIT_ID`): orange left border + warm background tint, "You" label
- Loading state: single spinner for the whole tab while data fetches
- Empty state: never expected (constants always include friends + self)
- Partial failure: players whose FACEIT fetch fails are silently skipped (returned without breaking the page)

---

## Data Architecture

### Player list — single-user app

This is a single-user app. The player list is:
```typescript
import { TRACKED_FRIENDS, MY_FACEIT_ID } from "@/lib/constants";
const allPlayers = [MY_FACEIT_ID, ...TRACKED_FRIENDS]; // 21 players total (20 friends + self)
```

No dynamic DB query for user friends. No `userId` parameter needed.

### DB migration — `match_player_stats`

Add one new column:

```sql
ALTER TABLE match_player_stats ADD COLUMN kr_ratio FLOAT DEFAULT 0;
```

Historical rows get `kr_ratio = 0` — acceptable, only new fetches populate it.

### Parser update — `src/lib/faceit.ts`

`parseMatchStats` adds:
```typescript
krRatio: parseFloat(s["K/R Ratio"]) || 0,
```

`MatchPlayerStats` type in `src/lib/types.ts` gains `krRatio: number`.

### Sync vs. Query — two separate operations

Running a live FACEIT API sync for 21 players × 100 matches in the request path would take ~180s and time out on Vercel. Instead, the architecture separates sync from query:

- **`getStatsLeaderboard(n)`** — fast, reads only from DB, returns whatever data exists
- **`syncAllPlayerHistory(n)`** — slow, mutating, called explicitly via a "Refresh" button

### New internal helper — `syncPlayerHistory`

A non-exported async function in `src/server/matches.ts`:

```typescript
async function syncPlayerHistory(faceitId: string, n: number): Promise<void>
```

Algorithm:
1. Fetch last N match IDs via `fetchPlayerHistory(faceitId, n)` — FACEIT returns up to N (may return fewer if player has fewer career games)
2. For each match (batched 5 at a time with 150ms delay, using `Promise.allSettled` to skip failures):
   a. Call `fetchMatchStats(matchId)` to get full stats
   b. If `stats.rounds` is empty or null — skip (match is not FINISHED or has no data)
   c. Upsert into `matches` table (`faceit_match_id`, `status: "FINISHED"`, `map`, `score`, `finished_at`)
   d. Fetch the inserted `matches.id`
   e. If `matchRow` is null — skip (upsert failed)
   f. Find this player's stats in the response via `parseMatchStats`
   g. Upsert into `match_player_stats` (`match_id`, `faceit_player_id`, all stat columns including `kr_ratio`, `win`, `played_at`)
   — Conflict key: `(match_id, faceit_player_id)` — safe to re-upsert
3. Failures swallowed per-match (same pattern as existing `getPlayerStats`)

Note: `win` is the DB column name (mapped from `p.result` in `parseMatchStats`).

### New server function — `syncAllPlayerHistory` (mutation)

```typescript
export const syncAllPlayerHistory = createServerFn({ method: "POST" })
  .inputValidator((n: 20 | 50 | 100) => n)
  .handler(async ({ data: n }) => {
    for (const faceitId of [MY_FACEIT_ID, ...TRACKED_FRIENDS]) {
      await syncPlayerHistory(faceitId, n);
    }
  })
```

Called from the UI via a "Refresh" button. Runs sequentially to avoid FACEIT rate limits. Expected duration: ~30-180s depending on N. The UI shows a loading spinner on the button while in progress.

### New server function — `getStatsLeaderboard` (query)

```typescript
export const getStatsLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((n: 20 | 50 | 100) => n)
  .handler(async ({ data: n }) => { ... })
```

Algorithm:
1. For each player in `[MY_FACEIT_ID, ...TRACKED_FRIENDS]`: query `match_player_stats` using a window query to get their last N records ordered by `played_at DESC`, then aggregate:
   ```sql
   SELECT
     AVG(kd_ratio) as avg_kd,
     AVG(adr) as avg_adr,
     AVG(kr_ratio) as avg_kr,
     AVG(hs_percent) as avg_hs,
     AVG(win::int) * 100 as win_rate,
     COUNT(*) as games_played,
     MAX(nickname) as nickname
   FROM (
     SELECT * FROM match_player_stats
     WHERE faceit_player_id = $id
     ORDER BY played_at DESC
     LIMIT $n
   ) sub
   ```
2. ELO source: query `tracked_friends.elo` per friend; for `MY_FACEIT_ID` call `fetchPlayer(MY_FACEIT_ID)` to get current ELO
3. Sort by `avgKd` descending
4. Return `StatsLeaderboardEntry[]` — players with 0 games are included with null/0 stats (they need a sync)

### New type — `StatsLeaderboardEntry`

```typescript
interface StatsLeaderboardEntry {
  faceitId: string;
  nickname: string;
  elo: number;
  gamesPlayed: number;
  avgKd: number;
  avgAdr: number;
  winRate: number;       // 0–100
  avgHsPercent: number;  // 0–100
  avgKrRatio: number;
}
```

### New hooks

```typescript
// src/hooks/useStatsLeaderboard.ts
useStatsLeaderboard(n: 20 | 50 | 100): UseQueryResult<StatsLeaderboardEntry[]>
// queryKey: ["stats-leaderboard", n] — re-fetches when N changes
// staleTime: 5 * 60 * 1000 (5 minutes)

// src/hooks/useSyncPlayerHistory.ts (or inline in component)
useSyncPlayerHistory(): UseMutationResult
// calls syncAllPlayerHistory(n)
// on success: invalidates ["stats-leaderboard"] query key to trigger refetch
```

### DB upsert update

The existing upsert in `getMatchDetails` (`src/server/matches.ts` ~line 235) must add `kr_ratio: p.krRatio` to the upsert payload so live-match stats also store K/R ratio.

### `MatchPlayerStats` type update

`src/lib/types.ts`: add `krRatio: number` to the `MatchPlayerStats` interface (the type populated by `parseMatchStats`).

---

## Performance

- **Page load**: `getStatsLeaderboard` queries DB only — instant regardless of N.
- **Refresh button**: calls `syncAllPlayerHistory(n)` — worst case ~180s for N=100. Button shows spinner. On completion, React Query cache is invalidated and the table re-fetches from DB.
- **React Query stale time**: 5 min — navigating away and back within 5 min uses cached data.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/003_stats_leaderboard.sql` | Add `kr_ratio` column |
| `src/lib/types.ts` | Add `krRatio` to `MatchPlayerStats`, add `StatsLeaderboardEntry` |
| `src/lib/faceit.ts` | Parse `K/R Ratio` in `parseMatchStats` |
| `src/server/matches.ts` | Add `syncPlayerHistory` helper, `getStatsLeaderboard` + `syncAllPlayerHistory` fns, update `getMatchDetails` upsert |
| `src/hooks/useStatsLeaderboard.ts` | New query hook |
| `src/hooks/useSyncPlayerHistory.ts` | New mutation hook |
| `src/routes/_authed/leaderboard.tsx` | Add tabs, Stats tab UI with filter pill and sortable table |

---

## Out of Scope (v1)

- RWS: not in FACEIT Data API v4 (confirmed via testing 3 recent matches)
- Per-player progressive loading
- Persistent sort preference (URL params or localStorage)
- Additional stats columns (Entry Rate, 1v1 Win Rate, Utility Damage) — available from API, deferred
- Background sync / cron job to pre-warm stats
- Multi-user support
