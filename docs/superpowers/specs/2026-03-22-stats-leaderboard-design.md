# Stats Leaderboard Design

**Date:** 2026-03-22
**Status:** Approved

## Summary

Extend the `/leaderboard` page with a **Stats tab** that ranks all tracked friends (and the current user) by aggregated CS2 performance stats over a selectable window of last 20, 50, or 100 games. The existing betting leaderboard becomes the **Bets tab**.

---

## Navigation

No new routes. `/leaderboard` gains two tabs:

- **Stats** (first, default active)
- **Bets** (existing content, unchanged)

---

## Stats Tab UI

### Filter
A pill toggle at the top of the tab: `20 | 50 | 100` games. Global — affects all rows simultaneously. Default: `20`.

### Table

| Column | Key | Notes |
|--------|-----|-------|
| # | rank | 1-indexed, sorted position |
| Player | nickname + ELO | ELO shown inline in muted text |
| GP | games played | Actual games used — may be less than selected N if history is sparse |
| K/D | avg kd_ratio | **Default sort column**, descending, highlighted in orange |
| ADR | avg adr | Average damage per round |
| WIN% | win rate | Wins / GP × 100 |
| HS% | avg hs_percent | Average headshot percentage |
| K/R | avg kr_ratio | Kills per round |

All column headers are clickable to re-sort (ascending/descending toggle). Sort state is local component state — no URL persistence needed.

### Visual treatment
- Top 3 rows: gold / silver / bronze rank number
- Current user's row: orange left border + warm background tint, "You" label
- Loading state: single spinner for the whole tab while data fetches
- Empty state: "No friends tracked yet" if tracked_friends is empty

---

## Data Architecture

### What's not changing
- Bets tab content is identical to the current leaderboard (coins, bets placed, won, win%)
- No new routes, no background jobs, no cron

### DB migration — `match_player_stats`

Add one new column:

```sql
ALTER TABLE match_player_stats ADD COLUMN kr_ratio FLOAT DEFAULT 0;
```

Historical rows will have `kr_ratio = 0` (acceptable — only new fetches will populate it).

### Parser update — `src/lib/faceit.ts`

`parseMatchStats` picks up `"K/R Ratio"` from the FACEIT API response:

```typescript
krRatio: parseFloat(s["K/R Ratio"]) || 0,
```

`MatchPlayerStats` type in `src/lib/types.ts` gains `krRatio: number`.

The DB upsert in `src/server/matches.ts` stores `kr_ratio`.

### New server function — `getStatsLeaderboard`

Location: `src/server/matches.ts` (or `src/server/leaderboard.ts` if file grows too large).

Signature:
```typescript
getStatsLeaderboard(userId: string, n: 20 | 50 | 100): Promise<StatsLeaderboardEntry[]>
```

Algorithm:
1. Fetch user's own `faceit_id` from `profiles` (joined with `tracked_friends` or stored on profile)
2. Fetch all `tracked_friends` for this user → list of `faceit_id`s
3. Combine: `[userFaceitId, ...friendFaceitIds]`
4. For each player:
   a. Count existing records in `match_player_stats` where `faceit_player_id = playerId`
   b. If count < N: call existing `getPlayerStats(playerId, limit: n)` to fetch and store missing matches (same batch approach with 150ms delays between groups of 5)
   c. Query last N records from `match_player_stats` ordered by `played_at DESC`, aggregate averages
5. Compute per player: `avgKd`, `avgAdr`, `winRate`, `avgHsPercent`, `avgKrRatio`, `gamesPlayed`
6. Sort by `avgKd` descending
7. Return `StatsLeaderboardEntry[]`

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

### New hook — `useStatsLeaderboard`

Location: `src/hooks/useStatsLeaderboard.ts`

```typescript
useStatsLeaderboard(n: 20 | 50 | 100): UseQueryResult<StatsLeaderboardEntry[]>
```

- staleTime: 5 minutes (stats don't change that fast)
- queryKey: `["stats-leaderboard", n]` — re-fetches when N changes

---

## Performance

- **First load** may be slow if DB has sparse history — API fetches up to 100 matches per player in batches of 5 with 150ms delays. For 10 friends × 100 matches = ~200 API calls → ~30–60s worst case. A page-level loading spinner covers this.
- **Subsequent loads** hit DB directly (aggregate query) — instant, no API calls.
- **N change** (e.g., 20 → 50): only fetches additional matches not already in DB.

---

## Out of Scope (v1)

- RWS: not available in FACEIT Data API v4 (confirmed via testing)
- Per-player progressive loading
- Persistent sort preference (URL params or localStorage)
- Additional stats columns (Entry Rate, 1v1 Win Rate, Utility Damage) — available from API but deferred
- Background sync / cron job to pre-warm stats
