# Stats Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stats tab to `/leaderboard` showing CS2 performance stats (K/D, ADR, WIN%, HS%, K/R) for all tracked friends + self, aggregated over last 20/50/100 games, with sortable columns and a Refresh button that syncs history from FACEIT API.

**Architecture:** Sync and query are separated — `getStatsLeaderboard` reads only from DB (instant), `syncAllPlayerHistory` fetches from FACEIT API and stores to DB (slow, user-triggered). The existing betting leaderboard moves under a Bets tab; Stats is the new first/default tab.

**Tech Stack:** TanStack Start (`createServerFn`), TanStack React Query (`useQuery`/`useMutation`), Supabase Postgres, FACEIT Data API v4, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/003_stats_leaderboard.sql` | Create | Add `kr_ratio` column + query index |
| `src/lib/types.ts` | Modify | Add `krRatio` to `MatchPlayerStats`; add `StatsLeaderboardEntry` |
| `src/lib/faceit.ts` | Modify | Parse `"K/R Ratio"` in `parseMatchStats` |
| `src/server/matches.ts` | Modify | Add `syncPlayerHistory` helper, `getStatsLeaderboard`, `syncAllPlayerHistory`; update `getMatchDetails` upsert |
| `src/hooks/useStatsLeaderboard.ts` | Create | Query hook for stats leaderboard data |
| `src/hooks/useSyncPlayerHistory.ts` | Create | Mutation hook for triggering sync |
| `src/routes/_authed/leaderboard.tsx` | Modify | Add tabs (Stats/Bets), filter pill, sortable stats table, Refresh button |

---

## Task 1: DB Migration — Add kr_ratio column

**Files:**
- Create: `supabase/migrations/003_stats_leaderboard.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/003_stats_leaderboard.sql

-- Add K/R ratio to per-match player stats
ALTER TABLE match_player_stats ADD COLUMN kr_ratio NUMERIC(4,2) DEFAULT 0;

-- Compound index for "last N per player" queries used by stats leaderboard
CREATE INDEX idx_match_stats_player_played
  ON match_player_stats(faceit_player_id, played_at DESC);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: migration applied, no errors. If `supabase` CLI not installed locally, apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Verify column exists**

```bash
npx supabase db diff
```

Expected: no diff (migration applied cleanly). Alternatively, run in Supabase dashboard:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'match_player_stats' AND column_name = 'kr_ratio';
```
Expected: 1 row returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_stats_leaderboard.sql
git commit -m "feat(db): add kr_ratio column and player stats index"
```

---

## Task 2: Types + Parser — Add krRatio everywhere

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/faceit.ts`

- [ ] **Step 1: Add `krRatio` to `MatchPlayerStats` in `src/lib/types.ts`**

Find the `MatchPlayerStats` interface and add `krRatio: number` after `hsPercent`:

```typescript
export interface MatchPlayerStats {
  playerId: string;
  nickname: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  mvps: number;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  krRatio: number;          // ← add this
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  result: boolean;
}
```

- [ ] **Step 2: Add `StatsLeaderboardEntry` to `src/lib/types.ts`**

Add after the `MatchPlayerStats` interface:

```typescript
export interface StatsLeaderboardEntry {
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

- [ ] **Step 3: Update `parseMatchStats` in `src/lib/faceit.ts`**

Find the `parseMatchStats` function and add `krRatio` after `hsPercent`:

```typescript
export function parseMatchStats(raw: any): MatchPlayerStats {
  const s = raw.player_stats || {};
  return {
    playerId: raw.player_id,
    nickname: raw.nickname,
    kills: parseInt(s["Kills"]) || 0,
    deaths: parseInt(s["Deaths"]) || 0,
    assists: parseInt(s["Assists"]) || 0,
    headshots: parseInt(s["Headshots"]) || 0,
    mvps: parseInt(s["MVPs"]) || 0,
    kdRatio: parseFloat(s["K/D Ratio"]) || 0,
    adr: parseFloat(s["ADR"]) || 0,
    hsPercent: parseInt(s["Headshots %"]) || 0,
    krRatio: parseFloat(s["K/R Ratio"]) || 0,   // ← add this
    tripleKills: parseInt(s["Triple Kills"]) || 0,
    quadroKills: parseInt(s["Quadro Kills"]) || 0,
    pentaKills: parseInt(s["Penta Kills"]) || 0,
    result: s["Result"] === "1",
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors appear, they'll be in files that destructure `MatchPlayerStats` — fix by adding `krRatio` to any spreads or picks that need updating.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/faceit.ts
git commit -m "feat: add krRatio to MatchPlayerStats type and parser"
```

---

## Task 3: syncPlayerHistory helper

**Files:**
- Modify: `src/server/matches.ts`

This is a non-exported async function that fetches a player's match history from FACEIT and upserts into the DB. It stores all players from each match (not just the target player), so that when multiple friends are in the same match only one API call is needed across syncs.

- [ ] **Step 1: Add import for constants at top of `src/server/matches.ts`**

The file already imports `TRACKED_FRIENDS`. Add `MY_FACEIT_ID` to the same import:

```typescript
import { TRACKED_FRIENDS, MY_FACEIT_ID } from "~/lib/constants";
```

- [ ] **Step 2: Add `syncPlayerHistory` function to `src/server/matches.ts`**

Add this after the existing imports and constants, before the exported `createServerFn` functions:

```typescript
async function syncPlayerHistory(faceitId: string, n: number): Promise<void> {
  const supabase = createServerSupabase();
  const history = await fetchPlayerHistory(faceitId, n);

  for (let i = 0; i < history.length; i += 5) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = history.slice(i, i + 5);
    await Promise.allSettled(
      batch.map(async (h: any) => {
        const statsData = await fetchMatchStats(h.match_id).catch(() => null);
        const round = statsData?.rounds?.[0];
        if (!round) return; // not FINISHED or no data

        const map = round.round_stats?.Map || "unknown";
        const score = round.round_stats?.Score || "";

        // Upsert into matches table to get a stable UUID
        await supabase.from("matches").upsert(
          {
            faceit_match_id: h.match_id,
            status: "FINISHED",
            map,
            score,
            started_at: h.started_at
              ? new Date(h.started_at * 1000).toISOString()
              : null,
            finished_at: h.finished_at
              ? new Date(h.finished_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "faceit_match_id" }
        );

        const { data: matchRow } = await supabase
          .from("matches")
          .select("id")
          .eq("faceit_match_id", h.match_id)
          .single();

        if (!matchRow) return;

        // Upsert all players from the match (not just faceitId)
        // This way a match shared by multiple friends only needs one API call
        for (const team of round.teams || []) {
          for (const player of team.players || []) {
            const p = parseMatchStats(player);
            await supabase.from("match_player_stats").upsert(
              {
                match_id: matchRow.id,
                faceit_player_id: p.playerId,
                nickname: p.nickname,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                headshots: p.headshots,
                mvps: p.mvps,
                kd_ratio: p.kdRatio,
                adr: p.adr,
                hs_percent: p.hsPercent,
                kr_ratio: p.krRatio,
                triple_kills: p.tripleKills,
                quadro_kills: p.quadroKills,
                penta_kills: p.pentaKills,
                win: p.result,
                map,
                played_at: h.finished_at
                  ? new Date(h.finished_at * 1000).toISOString()
                  : null,
              },
              { onConflict: "match_id,faceit_player_id" }
            );
          }
        }
      })
    );
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat: add syncPlayerHistory internal helper"
```

---

## Task 4: Update getMatchDetails upsert for kr_ratio

**Files:**
- Modify: `src/server/matches.ts` (~line 235)

The existing `getMatchDetails` function upserts into `match_player_stats` for live matches that finish. Add `kr_ratio` so live match stats also capture K/R ratio.

- [ ] **Step 1: Find the match_player_stats upsert in `getMatchDetails`**

Around line 235, find this block:
```typescript
await supabase.from("match_player_stats").upsert(
  {
    match_id: matchRow.id,
    faceit_player_id: p.playerId,
    // ... other fields
    penta_kills: p.pentaKills,
    win: p.result,
```

- [ ] **Step 2: Add `kr_ratio: p.krRatio` to the upsert payload**

Add it after `hs_percent: p.hsPercent`:

```typescript
hs_percent: p.hsPercent,
kr_ratio: p.krRatio,    // ← add this line
triple_kills: p.tripleKills,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat: store kr_ratio in getMatchDetails live match upsert"
```

---

## Task 5: getStatsLeaderboard server function

**Files:**
- Modify: `src/server/matches.ts`

Query-only server function — reads from DB, no FACEIT API calls. Aggregates last N records per player in JS.

- [ ] **Step 1: Add `getStatsLeaderboard` to `src/server/matches.ts`**

Add after `getPlayerStats` export:

```typescript
export const getStatsLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((n: number) => n as 20 | 50 | 100)
  .handler(async ({ data: n }): Promise<import("~/lib/types").StatsLeaderboardEntry[]> => {
    const supabase = createServerSupabase();
    const allPlayers = [MY_FACEIT_ID, ...TRACKED_FRIENDS];

    // Fetch ELO for friends from tracked_friends table
    const { data: friendRows } = await supabase
      .from("tracked_friends")
      .select("faceit_id, nickname, elo")
      .in("faceit_id", [...TRACKED_FRIENDS]);
    const friendMap = new Map(
      (friendRows || []).map((f) => [f.faceit_id, { nickname: f.nickname, elo: f.elo ?? 0 }])
    );

    // Fetch self ELO from FACEIT API
    let selfElo = 0;
    try {
      const { fetchPlayer } = await import("~/lib/faceit");
      const self = await fetchPlayer(MY_FACEIT_ID);
      selfElo = self.elo;
    } catch {
      // Ignore — selfElo stays 0
    }

    const entries: import("~/lib/types").StatsLeaderboardEntry[] = [];

    for (const faceitId of allPlayers) {
      const { data: rows } = await supabase
        .from("match_player_stats")
        .select("kd_ratio, adr, kr_ratio, hs_percent, win, nickname")
        .eq("faceit_player_id", faceitId)
        .order("played_at", { ascending: false })
        .limit(n);

      if (!rows || rows.length === 0) {
        // No data yet — include with zeroes so the row shows in the table
        const meta = faceitId === MY_FACEIT_ID
          ? { nickname: "soavarice", elo: selfElo }
          : friendMap.get(faceitId) ?? { nickname: faceitId.slice(0, 8), elo: 0 };
        entries.push({
          faceitId,
          nickname: meta.nickname,
          elo: meta.elo,
          gamesPlayed: 0,
          avgKd: 0,
          avgAdr: 0,
          winRate: 0,
          avgHsPercent: 0,
          avgKrRatio: 0,
        });
        continue;
      }

      const gamesPlayed = rows.length;
      const avg = (key: keyof typeof rows[0]) =>
        rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / gamesPlayed;

      const nickname = rows[0].nickname ||
        (faceitId === MY_FACEIT_ID
          ? "soavarice"
          : friendMap.get(faceitId)?.nickname ?? faceitId.slice(0, 8));
      const elo = faceitId === MY_FACEIT_ID
        ? selfElo
        : friendMap.get(faceitId)?.elo ?? 0;

      entries.push({
        faceitId,
        nickname,
        elo,
        gamesPlayed,
        avgKd: Math.round(avg("kd_ratio") * 100) / 100,
        avgAdr: Math.round(avg("adr") * 10) / 10,
        winRate: Math.round((rows.filter((r) => r.win).length / gamesPlayed) * 100),
        avgHsPercent: Math.round(avg("hs_percent")),
        avgKrRatio: Math.round(avg("kr_ratio") * 100) / 100,
      });
    }

    // Sort by avgKd descending (default)
    entries.sort((a, b) => b.avgKd - a.avgKd);
    return entries;
  });
```

Note: `MY_NICKNAME` constant is `"soavarice"` — used as fallback for self nickname. Import it from constants if needed, or use the string literal directly.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat: add getStatsLeaderboard server function"
```

---

## Task 6: syncAllPlayerHistory server function

**Files:**
- Modify: `src/server/matches.ts`

POST mutation — loops all 21 players sequentially, calls syncPlayerHistory for each.

- [ ] **Step 1: Add `syncAllPlayerHistory` to `src/server/matches.ts`**

Add after `getStatsLeaderboard`:

```typescript
export const syncAllPlayerHistory = createServerFn({ method: "POST" })
  .inputValidator((n: number) => n as 20 | 50 | 100)
  .handler(async ({ data: n }): Promise<void> => {
    for (const faceitId of [MY_FACEIT_ID, ...TRACKED_FRIENDS]) {
      await syncPlayerHistory(faceitId, n);
    }
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat: add syncAllPlayerHistory server function"
```

---

## Task 7: useStatsLeaderboard hook

**Files:**
- Create: `src/hooks/useStatsLeaderboard.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useStatsLeaderboard.ts
import { useQuery } from "@tanstack/react-query";
import { getStatsLeaderboard } from "~/server/matches";
import type { StatsLeaderboardEntry } from "~/lib/types";

export function useStatsLeaderboard(n: 20 | 50 | 100) {
  return useQuery<StatsLeaderboardEntry[]>({
    queryKey: ["stats-leaderboard", n],
    queryFn: () => getStatsLeaderboard({ data: n }),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStatsLeaderboard.ts
git commit -m "feat: add useStatsLeaderboard query hook"
```

---

## Task 8: useSyncPlayerHistory hook

**Files:**
- Create: `src/hooks/useSyncPlayerHistory.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useSyncPlayerHistory.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAllPlayerHistory } from "~/server/matches";

export function useSyncPlayerHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (n: 20 | 50 | 100) => syncAllPlayerHistory({ data: n }),
    onSuccess: () => {
      // Invalidate all stats-leaderboard queries (any N value)
      queryClient.invalidateQueries({ queryKey: ["stats-leaderboard"] });
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSyncPlayerHistory.ts
git commit -m "feat: add useSyncPlayerHistory mutation hook"
```

---

## Task 9: Leaderboard page UI

**Files:**
- Modify: `src/routes/_authed/leaderboard.tsx`

Replace the current single-page leaderboard with a tabbed layout. Stats tab first (default), Bets tab second. Stats tab has: filter pill (20/50/100), sortable table, Refresh button.

**Sort state shape:**
```typescript
type SortKey = "avgKd" | "avgAdr" | "winRate" | "avgHsPercent" | "avgKrRatio" | "gamesPlayed";
type SortDir = "asc" | "desc";
```

**Column definitions** (used for headers + rendering):
```typescript
const STATS_COLS: { key: SortKey; label: string; decimals: number; suffix?: string }[] = [
  { key: "avgKd",       label: "K/D",  decimals: 2 },
  { key: "avgAdr",      label: "ADR",  decimals: 1 },
  { key: "winRate",     label: "WIN%", decimals: 0, suffix: "%" },
  { key: "avgHsPercent",label: "HS%",  decimals: 0, suffix: "%" },
  { key: "avgKrRatio",  label: "K/R",  decimals: 2 },
];
```

- [ ] **Step 1: Rewrite `src/routes/_authed/leaderboard.tsx`**

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import { useStatsLeaderboard } from "~/hooks/useStatsLeaderboard";
import { useSyncPlayerHistory } from "~/hooks/useSyncPlayerHistory";
import { MY_FACEIT_ID } from "~/lib/constants";
import { useEffect, useState } from "react";
import type { StatsLeaderboardEntry } from "~/lib/types";

const requireAuth = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" as any });
  });

const getCurrentUserId = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.user.id ?? null;
  });

export const Route = createFileRoute("/_authed/leaderboard")({
  beforeLoad: () => requireAuth(),
  component: LeaderboardPage,
});

type Tab = "stats" | "bets";
type SortKey = "avgKd" | "avgAdr" | "winRate" | "avgHsPercent" | "avgKrRatio" | "gamesPlayed";
type SortDir = "asc" | "desc";

const STATS_COLS: { key: SortKey; label: string; decimals: number; suffix?: string }[] = [
  { key: "avgKd",        label: "K/D",  decimals: 2 },
  { key: "avgAdr",       label: "ADR",  decimals: 1 },
  { key: "winRate",      label: "WIN%", decimals: 0, suffix: "%" },
  { key: "avgHsPercent", label: "HS%",  decimals: 0, suffix: "%" },
  { key: "avgKrRatio",   label: "K/R",  decimals: 2 },
];

function fmt(val: number, decimals: number, suffix = "") {
  return val === 0 ? "—" : `${val.toFixed(decimals)}${suffix}`;
}

function sortEntries(
  entries: StatsLeaderboardEntry[],
  key: SortKey,
  dir: SortDir
): StatsLeaderboardEntry[] {
  return [...entries].sort((a, b) =>
    dir === "desc" ? b[key] - a[key] : a[key] - b[key]
  );
}

function StatsTab() {
  const [n, setN] = useState<20 | 50 | 100>(20);
  const [sortKey, setSortKey] = useState<SortKey>("avgKd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: rawEntries = [], isLoading } = useStatsLeaderboard(n);
  const sync = useSyncPlayerHistory();

  const entries = sortEntries(rawEntries, sortKey, sortDir);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rankColor = (i: number) =>
    i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-text-dim";

  return (
    <div className="flex flex-col gap-4">
      {/* Filter pill + Refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-text-dim text-xs mr-1">Last</span>
          {([20, 50, 100] as const).map((v) => (
            <button
              key={v}
              onClick={() => setN(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                n === v ? "bg-accent text-white" : "bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {v}
            </button>
          ))}
          <span className="text-text-dim text-xs ml-1">games</span>
        </div>
        <button
          onClick={() => sync.mutate(n)}
          disabled={sync.isPending}
          className="text-xs px-3 py-1 rounded bg-bg-elevated text-text-muted hover:text-text disabled:opacity-50 transition-colors"
        >
          {sync.isPending ? "Syncing..." : "↻ Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Header row */}
          <div className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
            style={{ gridTemplateColumns: "2rem 1fr 3rem repeat(5, 4rem)" }}>
            <span>#</span>
            <span>Player</span>
            <span className="text-right">GP</span>
            {STATS_COLS.map((col) => (
              <button
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`text-right hover:text-text transition-colors ${
                  sortKey === col.key ? "text-accent" : ""
                }`}
              >
                {col.label}{sortKey === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>

          {entries.map((entry, i) => {
            const isMe = entry.faceitId === MY_FACEIT_ID;
            return (
              <div
                key={entry.faceitId}
                className={`grid gap-2 items-center px-3 py-2 rounded text-sm ${
                  isMe
                    ? "bg-accent/10 border-l-2 border-accent"
                    : "bg-bg-elevated"
                }`}
                style={{ gridTemplateColumns: "2rem 1fr 3rem repeat(5, 4rem)" }}
              >
                <span className={`text-xs font-bold ${rankColor(i)}`}>{i + 1}</span>
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className={`font-bold truncate ${isMe ? "text-accent" : "text-text"}`}>
                    {isMe ? "You" : entry.nickname}
                  </span>
                  {entry.elo > 0 && (
                    <span className="text-text-dim text-[10px] shrink-0">{entry.elo}</span>
                  )}
                </div>
                <span className="text-right text-text-muted text-xs">{entry.gamesPlayed || "—"}</span>
                {STATS_COLS.map((col) => (
                  <span
                    key={col.key}
                    className={`text-right text-xs ${
                      sortKey === col.key ? "text-accent font-semibold" : "text-text-muted"
                    }`}
                  >
                    {fmt(entry[col.key], col.decimals, col.suffix)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BetsTab() {
  const { data: entries = [], isLoading } = useLeaderboard();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  return (
    <>
      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
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
                  isMe ? "bg-accent/10 border border-accent/30" : "bg-bg-elevated"
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
    </>
  );
}

function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Leaderboard</h2>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {(["stats", "bets"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t === "stats" ? "Stats" : "Bets"}
          </button>
        ))}
      </div>

      {tab === "stats" ? <StatsTab /> : <BetsTab />}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors — most likely issues are around `StatsLeaderboardEntry[col.key]` indexing (TypeScript may need a cast) or `border-border` class if that token doesn't exist in your Tailwind config (use `border-bg-elevated` as fallback).

- [ ] **Step 3: Run dev server and manually verify**

```bash
npm run dev
```

Open http://localhost:3000/leaderboard. Verify:
- Tabs appear: Stats (active by default) | Bets
- Bets tab shows the existing leaderboard content unchanged
- Stats tab shows loading state, then table rows (may be all zeroes until synced)
- Filter pills (20 / 50 / 100) render and are clickable
- Refresh button is visible

- [ ] **Step 4: Trigger first sync and verify data appears**

Click "↻ Refresh" on the Stats tab. Button should show "Syncing..." for 30-180s (N=20 is fastest). After completion, the table should populate with real K/D, ADR, WIN%, HS%, K/R values.

Verify:
- Players appear sorted by K/D descending
- "You" row (soavarice) has orange left border
- Top 3 ranks are gold/silver/bronze
- GP column shows ≤ 20 (the selected N)
- Clicking a column header re-sorts the table
- Clicking same header twice toggles direction

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authed/leaderboard.tsx
git commit -m "feat: add Stats/Bets tabs to leaderboard with sortable stats table"
```

---

## Final Verification

- [ ] Switch between 20/50/100 — data re-fetches, GP counts change
- [ ] Click each column header — table re-sorts, active column highlights orange
- [ ] Navigate away and back within 5 min — no loading state (React Query cache hit)
- [ ] Navigate away and back after 5 min — re-fetches from DB (fast, no spinner expected)
- [ ] TypeScript: `npx tsc --noEmit` — zero errors
- [ ] Build: `npm run build` — no build errors
