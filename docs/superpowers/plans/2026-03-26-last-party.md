# Last Party Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/last-party` route that shows a comprehensive party session recap with awards, aggregate stats, map distribution, per-match accordions with banters, and optional demo analytics.

**Architecture:** New route at `src/routes/_authed/last-party.tsx` with search params (player, date). Server function `getPartySessionStats` in `src/server/matches.ts` reuses existing private helpers (`fetchPlayerHistoryRange`, `fetchDemoAnalyticsForMatch`, `classifyKnownFriendQueue`). New types in `src/lib/types.ts`. New components in `src/components/last-party/`. Session banter lines added to `src/lib/banter.ts`. Navigation updated in `src/routes/_authed.tsx` and `src/lib/player-view-shell.ts`.

**Tech Stack:** React 19, TanStack Router + React Query + React Start, Recharts, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-26-last-party-design.md`

---

## File Structure

### New Files
- `src/lib/last-party.ts` — Types, award computation, aggregate stats logic, map constants
- `src/hooks/usePartySession.ts` — React Query hook for party session data
- `src/components/last-party/LastPartyHeader.tsx` — Session header (date, W/L, hours, streak)
- `src/components/last-party/PartyAwards.tsx` — Awards section with superlatives + session banter
- `src/components/last-party/SessionStatsTable.tsx` — Aggregate stats table (demo/no-demo)
- `src/components/last-party/MapDistribution.tsx` — Map breakdown visual
- `src/components/last-party/MatchAccordion.tsx` — Per-match expandable rows with stats + banter
- `src/components/last-party/SessionAnalyst.tsx` — Radar charts + team aggregates (demo-only)
- `src/routes/_authed/last-party.tsx` — Route definition + page component
- `src/lib/__tests__/last-party.test.ts` — Unit tests for aggregation/award/streak logic

### Design Decisions (deviations from spec)
- **Date picker**: Uses native `<input type="date">` instead of `react-day-picker`. Avoids a new dependency for minimal UX difference; native inputs have good accessibility built-in.
- **Eager match stats loading**: All match stats are fetched in the server function rather than lazily on accordion expand. Typical party sessions are 3-10 matches, making eager loading simpler with negligible performance cost.

### Modified Files
- `src/lib/types.ts` — Add `PartySessionData`, `AggregatePlayerStats`, `SessionAward`, `MapStats`
- `src/lib/banter.ts` — Add session-level carry/roast lines + `getSessionBanterLine`
- `src/server/matches.ts` — Add `getPartySessionStats` server function
- `src/lib/time.ts` — Add `getCalendarDayRange(dateString)` and `getYesterdayDateString()` helpers
- `src/routes/_authed.tsx` — Add Last Party nav link
- `src/lib/player-view-shell.ts` — Add "last-party" to `PlayerView` type + href builder

---

## Task 1: Add Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new type definitions to `src/lib/types.ts`**

Add at the end of the file, before any betting-related types:

```typescript
export interface AggregatePlayerStats {
  faceitId: string
  nickname: string
  gamesPlayed: number
  wins: number
  avgKd: number
  avgAdr: number
  avgHsPercent: number
  avgKrRatio: number
  totalMvps: number
  totalTripleKills: number
  totalQuadroKills: number
  totalPentaKills: number
  // Demo-only (present when allHaveDemo)
  avgRating?: number
  avgRws?: number
  avgKast?: number
  avgTradeKills?: number
  avgUtilityDamage?: number
  avgEntryRate?: number
  avgEnemiesFlashed?: number
  avgEconomyEfficiency?: number
  totalClutchWins?: number
}

export interface SessionAward {
  id: string
  title: string
  recipient: string
  value: string
  banter?: string
  requiresDemo: boolean
}

export interface MapStats {
  map: string
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
}

export interface PartySessionData {
  date: string
  matches: PlayerHistoryMatch[]
  matchStats: Record<string, MatchPlayerStats[]>
  demoMatches: Record<string, DemoMatchAnalytics>
  allHaveDemo: boolean
  partyMembers: Array<Pick<FaceitPlayer, "faceitId" | "nickname">>
  aggregateStats: Record<string, AggregatePlayerStats>
  awards: SessionAward[]
  mapDistribution: MapStats[]
  totalHoursPlayed: number
  winCount: number
  lossCount: number
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors from new types, they're not referenced yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(last-party): add session data types"
```

---

## Task 2: Add Date Helper

**Files:**
- Modify: `src/lib/time.ts`
- Test: `src/lib/__tests__/time.test.ts` (if exists, otherwise create)

- [ ] **Step 1: Write failing test for `getCalendarDayRange`**

Create or update `src/lib/__tests__/time.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getCalendarDayRange } from "../time";

describe("getCalendarDayRange", () => {
  it("returns correct start/end for a given date string", () => {
    const result = getCalendarDayRange("2026-03-25");
    // Europe/Sofia is UTC+2 in March (EET), so midnight local = 22:00 UTC previous day
    expect(result.startUnix).toBeLessThan(result.endUnix);
    expect(result.endUnix - result.startUnix).toBe(86400); // exactly 24 hours
    expect(result.startIso).toContain("2026-03-24T22:00:00"); // midnight Sofia = 22:00 UTC
  });

  it("handles DST transition date", () => {
    // March 29 2026 is DST switch in Europe/Sofia (EET -> EEST, +2 -> +3)
    const result = getCalendarDayRange("2026-03-29");
    // Day still spans exactly the right boundaries even if DST changes
    expect(result.endUnix).toBeGreaterThan(result.startUnix);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/time.test.ts`
Expected: FAIL — `getCalendarDayRange` is not exported

- [ ] **Step 3: Implement `getCalendarDayRange` and `getYesterdayDateString` in `src/lib/time.ts`**

Add after `getPreviousCalendarDayRange`:

```typescript
export function getYesterdayDateString(
  now: Date = new Date(),
  timeZone = APP_TIME_ZONE
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  const todayMs = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
  const yesterday = new Date(todayMs - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().slice(0, 10);
}

export function getCalendarDayRange(
  dateString: string,
  timeZone = APP_TIME_ZONE
): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  startUnix: number;
  endUnix: number;
} {
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const dayStart = zonedMidnightToUtc({ year, month, day, timeZone });

  const nextDayProbe = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);
  const nextDayParts = getDatePartsInTimeZone(nextDayProbe, timeZone);
  const dayEnd = zonedMidnightToUtc({ ...nextDayParts, timeZone });

  return {
    start: dayStart,
    end: dayEnd,
    startIso: dayStart.toISOString(),
    endIso: dayEnd.toISOString(),
    startUnix: Math.floor(dayStart.getTime() / 1000),
    endUnix: Math.floor(dayEnd.getTime() / 1000),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/time.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "feat(last-party): add getCalendarDayRange date helper"
```

---

## Task 3: Add Session Banter Lines

**Files:**
- Modify: `src/lib/banter.ts`
- Test: `src/lib/__tests__/banter.test.ts` (if exists, otherwise create)

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it } from "vitest";
import { getSessionBanterLine } from "../banter";

describe("getSessionBanterLine", () => {
  it("returns a carry line with name interpolated", () => {
    const line = getSessionBanterLine("carry", "soavarice", "abc123", "2026-03-25");
    expect(line).toContain("soavarice");
    expect(line.length).toBeGreaterThan(0);
  });

  it("returns a roast line with name interpolated", () => {
    const line = getSessionBanterLine("roast", "noob123", "abc123", "2026-03-25");
    expect(line).toContain("noob123");
  });

  it("is deterministic for same inputs", () => {
    const a = getSessionBanterLine("carry", "soavarice", "abc123", "2026-03-25");
    const b = getSessionBanterLine("carry", "soavarice", "abc123", "2026-03-25");
    expect(a).toBe(b);
  });

  it("varies by date", () => {
    const a = getSessionBanterLine("carry", "soavarice", "abc123", "2026-03-25");
    const b = getSessionBanterLine("carry", "soavarice", "abc123", "2026-03-26");
    // Different dates should (usually) produce different lines
    // Not guaranteed but extremely likely with decent hash
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/banter.test.ts`
Expected: FAIL — `getSessionBanterLine` not exported

- [ ] **Step 3: Add session banter lines and function to `src/lib/banter.ts`**

Add after existing `ROAST_LINES`:

```typescript
const SESSION_CARRY_LINES = [
  "{name} owned the whole session, not just one map",
  "{name} was the main character all night",
  "{name} carried the party like it was their birthday",
  "The squad owes {name} dinner after that session",
  "{name} was built different today — every single map",
  "{name} didn't just show up, they showed out all session",
  "{name} was on a heater that lasted hours",
  "{name} turned a gaming session into a masterclass",
  "Somebody check {name}'s contract — they went overtime on frags",
  "{name} was the reason the lobby kept queuing",
  "{name} made every map look like their home turf",
  "{name} ran the session like a shift manager at the frag factory",
  "{name} put the team on their back for the whole night",
  "{name} was farming MVPs across multiple time zones",
  "{name} turned the session into a personal highlight tape",
];

const SESSION_ROAST_LINES = [
  "{name} was consistently inconsistent all session",
  "{name} attended every map but participated in none",
  "{name} was the session's designated spectator",
  "{name} brought their C game and it still wasn't enough",
  "At least {name} was there for morale... all night long",
  "{name} set a new personal worst — across multiple maps",
  "{name} was the anchor of the team, and not the good kind",
  "{name} contributed loading screen energy all session",
  "The squad carried {name} like checked luggage",
  "{name} played every map like it was their first time on a mouse",
  "{name} was on a cold streak that could freeze the server room",
  "{name} was the reason the party almost stopped queuing",
  "{name} got their money's worth from the respawn button",
  "{name} had a long night — unfortunately so did the team",
  "{name} was speedrunning the bottom of every scoreboard",
];
```

Add after existing `getBanterCatalogSize`:

```typescript
export function getSessionBanterLine(
  type: BanterType,
  name: string,
  playerId: string,
  date: string
): string {
  const lines = type === "carry" ? SESSION_CARRY_LINES : SESSION_ROAST_LINES;
  const index = hashMatchId(playerId + date + type) % lines.length;
  return lines[index].replace("{name}", name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/banter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/banter.ts src/lib/__tests__/banter.test.ts
git commit -m "feat(last-party): add session-level banter lines"
```

---

## Task 4: Add Last Party Logic Module

**Files:**
- Create: `src/lib/last-party.ts`
- Create: `src/lib/__tests__/last-party.test.ts`

- [ ] **Step 1: Write failing tests for award computation and aggregation**

Create `src/lib/__tests__/last-party.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { computeAggregateStats, computeAwards, computeMapDistribution, computeSessionStreak } from "../last-party";
import type { MatchPlayerStats, DemoPlayerAnalytics } from "../types";

const makePlayer = (overrides: Partial<MatchPlayerStats> & { playerId: string; nickname: string }): MatchPlayerStats => ({
  adr: 80, assists: 3, clutchKills: 0, damage: 1600, deaths: 15,
  doubleKills: 0, enemiesFlashed: 2, entryCount: 3, entryWins: 1,
  firstKills: 1, flashCount: 5, headshots: 8, hsPercent: 50,
  kdRatio: 1.0, kills: 15, krRatio: 0.6, mvps: 2, oneV1Count: 0,
  oneV1Wins: 0, oneV2Count: 0, oneV2Wins: 0, pentaKills: 0,
  pistolKills: 1, quadroKills: 0, result: true, sniperKills: 0,
  tripleKills: 0, utilityDamage: 50,
  ...overrides,
});

describe("computeAggregateStats", () => {
  it("averages stats across matches for a player", () => {
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match1": [makePlayer({ playerId: "p1", nickname: "Alice", kills: 20, kdRatio: 1.5, adr: 90 })],
      "match2": [makePlayer({ playerId: "p1", nickname: "Alice", kills: 10, kdRatio: 0.5, adr: 70 })],
    };
    const result = computeAggregateStats({
      matchIds: ["match1", "match2"],
      matchStats,
      partyMemberIds: ["p1"],
      demoMatches: {},
      allHaveDemo: false,
    });
    expect(result.p1.avgKd).toBeCloseTo(1.0);
    expect(result.p1.avgAdr).toBeCloseTo(80);
    expect(result.p1.gamesPlayed).toBe(2);
  });
});

describe("computeAwards", () => {
  it("picks MVP as highest avg K/D", () => {
    const stats: Record<string, { avgKd: number; avgAdr: number; avgHsPercent: number; nickname: string; [k: string]: any }> = {
      p1: { faceitId: "p1", nickname: "Alice", avgKd: 1.5, avgAdr: 80, avgHsPercent: 50, gamesPlayed: 2, wins: 1 },
      p2: { faceitId: "p2", nickname: "Bob", avgKd: 0.8, avgAdr: 90, avgHsPercent: 60, gamesPlayed: 2, wins: 1 },
    };
    const awards = computeAwards({ aggregateStats: stats as any, allHaveDemo: false, mapDistribution: [], playerId: "p1", date: "2026-03-25" });
    const mvp = awards.find((a) => a.id === "party-mvp");
    expect(mvp?.recipient).toBe("Alice");
    const anchor = awards.find((a) => a.id === "party-anchor");
    expect(anchor?.recipient).toBe("Bob");
  });

  it("picks Damage Dealer as highest ADR", () => {
    const stats: Record<string, any> = {
      p1: { faceitId: "p1", nickname: "Alice", avgKd: 1.0, avgAdr: 70, avgHsPercent: 50, gamesPlayed: 2, wins: 1 },
      p2: { faceitId: "p2", nickname: "Bob", avgKd: 1.0, avgAdr: 95, avgHsPercent: 40, gamesPlayed: 2, wins: 1 },
    };
    const awards = computeAwards({ aggregateStats: stats, allHaveDemo: false, mapDistribution: [], playerId: "p1", date: "2026-03-25" });
    const dd = awards.find((a) => a.id === "damage-dealer");
    expect(dd?.recipient).toBe("Bob");
  });
});

describe("computeMapDistribution", () => {
  it("counts maps and win rates", () => {
    const matches = [
      { map: "de_inferno", result: true },
      { map: "de_inferno", result: false },
      { map: "de_dust2", result: true },
    ] as any[];
    const result = computeMapDistribution(matches);
    const inferno = result.find((m) => m.map === "de_inferno");
    expect(inferno?.gamesPlayed).toBe(2);
    expect(inferno?.winRate).toBe(50);
    const dust2 = result.find((m) => m.map === "de_dust2");
    expect(dust2?.wins).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/last-party.test.ts`
Expected: FAIL — module not found

describe("computeSessionStreak", () => {
  it("returns zero streak for empty matches", () => {
    expect(computeSessionStreak([])).toEqual({ type: "win", count: 0 });
  });

  it("counts longest win streak", () => {
    const matches = [
      { result: true, startedAt: 1 },
      { result: true, startedAt: 2 },
      { result: false, startedAt: 3 },
      { result: true, startedAt: 4 },
    ] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "win", count: 2 });
  });

  it("counts longest loss streak", () => {
    const matches = [
      { result: true, startedAt: 1 },
      { result: false, startedAt: 2 },
      { result: false, startedAt: 3 },
      { result: false, startedAt: 4 },
    ] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "loss", count: 3 });
  });

  it("handles single match", () => {
    const matches = [{ result: true, startedAt: 1 }] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "win", count: 1 });
  });
});
```

- [ ] **Step 3: Create `src/lib/last-party.ts`**

```typescript
import { getSessionBanterLine } from "~/lib/banter";
import type {
  AggregatePlayerStats,
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  MapStats,
  MatchPlayerStats,
  PlayerHistoryMatch,
  SessionAward,
} from "~/lib/types";

export const MAP_COLORS: Record<string, string> = {
  de_inferno: "bg-[#cc9944]",
  de_dust2: "bg-[#ccaa88]",
  de_nuke: "bg-[#44aacc]",
  de_ancient: "bg-[#55aa77]",
  de_mirage: "bg-[#aa77cc]",
  de_anubis: "bg-[#77aa55]",
  de_vertigo: "bg-[#55aacc]",
};

export function mapDisplayName(map: string): string {
  return map.replace("de_", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function computeAggregateStats(params: {
  matchIds: string[];
  matchStats: Record<string, MatchPlayerStats[]>;
  partyMemberIds: string[];
  demoMatches: Record<string, DemoMatchAnalytics>;
  allHaveDemo: boolean;
}): Record<string, AggregatePlayerStats> {
  const { matchIds, matchStats, partyMemberIds, demoMatches, allHaveDemo } = params;
  const result: Record<string, AggregatePlayerStats> = {};

  for (const pid of partyMemberIds) {
    const playerMatches: MatchPlayerStats[] = [];
    const playerDemoStats: DemoPlayerAnalytics[] = [];

    for (const matchId of matchIds) {
      const players = matchStats[matchId] ?? [];
      const p = players.find((pl) => pl.playerId === pid);
      if (p) {
        playerMatches.push(p);
      }
      if (allHaveDemo && demoMatches[matchId]) {
        const dp = demoMatches[matchId].players.find(
          (pl) => pl.playerId === pid || pl.nickname.toLowerCase() === p?.nickname.toLowerCase()
        );
        if (dp) {
          playerDemoStats.push(dp);
        }
      }
    }

    if (playerMatches.length === 0) {
      continue;
    }

    const n = playerMatches.length;
    const nickname = playerMatches[0].nickname;

    const base: AggregatePlayerStats = {
      faceitId: pid,
      nickname,
      gamesPlayed: n,
      wins: playerMatches.filter((m) => m.result).length,
      avgKd: playerMatches.reduce((s, m) => s + m.kdRatio, 0) / n,
      avgAdr: playerMatches.reduce((s, m) => s + m.adr, 0) / n,
      avgHsPercent: playerMatches.reduce((s, m) => s + m.hsPercent, 0) / n,
      avgKrRatio: playerMatches.reduce((s, m) => s + m.krRatio, 0) / n,
      totalMvps: playerMatches.reduce((s, m) => s + m.mvps, 0),
      totalTripleKills: playerMatches.reduce((s, m) => s + m.tripleKills, 0),
      totalQuadroKills: playerMatches.reduce((s, m) => s + m.quadroKills, 0),
      totalPentaKills: playerMatches.reduce((s, m) => s + m.pentaKills, 0),
    };

    if (allHaveDemo && playerDemoStats.length > 0) {
      const dn = playerDemoStats.length;
      base.avgRating = playerDemoStats.reduce((s, d) => s + (d.rating ?? 0), 0) / dn;
      base.avgRws = playerDemoStats.reduce((s, d) => s + d.rws, 0) / dn;
      base.avgKast = playerDemoStats.reduce((s, d) => s + (d.kastPercent ?? 0), 0) / dn;
      base.avgTradeKills = playerDemoStats.reduce((s, d) => s + d.tradeKills, 0) / dn;
      base.avgUtilityDamage = playerDemoStats.reduce((s, d) => s + (d.utilityDamage ?? 0), 0) / dn;
      base.avgEntryRate = playerDemoStats.reduce((s, d) => {
        const attempts = d.openingDuelAttempts ?? 0;
        const wins = d.openingDuelWins ?? 0;
        return s + (attempts > 0 ? wins / attempts : 0);
      }, 0) / dn;
      base.avgEnemiesFlashed = playerDemoStats.reduce((s, d) => s + (d.enemiesFlashed ?? 0), 0) / dn;
      base.avgEconomyEfficiency = playerDemoStats.reduce((s, d) => s + (d.economyEfficiency ?? 0), 0) / dn;
      base.totalClutchWins = playerDemoStats.reduce((s, d) => s + (d.clutchWins ?? 0), 0);
    }

    result[pid] = base;
  }

  return result;
}

export function computeAwards(params: {
  aggregateStats: Record<string, AggregatePlayerStats>;
  allHaveDemo: boolean;
  mapDistribution: MapStats[];
  playerId: string;
  date: string;
}): SessionAward[] {
  const { aggregateStats, allHaveDemo, mapDistribution, playerId, date } = params;
  const entries = Object.values(aggregateStats).sort((a, b) =>
    a.nickname.localeCompare(b.nickname)
  );
  if (entries.length === 0) {
    return [];
  }

  const awards: SessionAward[] = [];

  // Helper: pick best by comparator (tiebreak = alphabetical, already sorted)
  const pickBest = (fn: (e: AggregatePlayerStats) => number) =>
    entries.reduce((best, e) => (fn(e) > fn(best) ? e : best), entries[0]);
  const pickWorst = (fn: (e: AggregatePlayerStats) => number) =>
    entries.reduce((worst, e) => (fn(e) < fn(worst) ? e : worst), entries[0]);

  // Party MVP
  const mvpMetric = allHaveDemo
    ? (e: AggregatePlayerStats) => e.avgRating ?? 0
    : (e: AggregatePlayerStats) => e.avgKd;
  const mvp = pickBest(mvpMetric);
  awards.push({
    id: "party-mvp",
    title: "Party MVP",
    recipient: mvp.nickname,
    value: allHaveDemo ? `${(mvp.avgRating ?? 0).toFixed(2)} Rating` : `${mvp.avgKd.toFixed(2)} K/D`,
    banter: getSessionBanterLine("carry", mvp.nickname, playerId, date),
    requiresDemo: false,
  });

  // Party Anchor (only if 2+ players)
  if (entries.length >= 2) {
    const anchor = pickWorst(mvpMetric);
    awards.push({
      id: "party-anchor",
      title: "Party Anchor",
      recipient: anchor.nickname,
      value: allHaveDemo ? `${(anchor.avgRating ?? 0).toFixed(2)} Rating` : `${anchor.avgKd.toFixed(2)} K/D`,
      banter: getSessionBanterLine("roast", anchor.nickname, playerId, date),
      requiresDemo: false,
    });
  }

  // Headshot Machine
  const hsMachine = pickBest((e) => e.avgHsPercent);
  awards.push({
    id: "headshot-machine",
    title: "Headshot Machine",
    recipient: hsMachine.nickname,
    value: `${Math.round(hsMachine.avgHsPercent)}% HS`,
    requiresDemo: false,
  });

  // Damage Dealer
  const dmgDealer = pickBest((e) => e.avgAdr);
  awards.push({
    id: "damage-dealer",
    title: "Damage Dealer",
    recipient: dmgDealer.nickname,
    value: `${Math.round(dmgDealer.avgAdr)} ADR`,
    requiresDemo: false,
  });

  // Map Specialist (only if 2+ different maps)
  const uniqueMaps = mapDistribution.filter((m) => m.gamesPlayed > 0);
  if (uniqueMaps.length >= 2) {
    const best = uniqueMaps.reduce((a, b) => (a.winRate > b.winRate ? a : b), uniqueMaps[0]);
    if (best.winRate > 0) {
      awards.push({
        id: "map-specialist",
        title: "Map Specialist",
        recipient: best.map,
        value: `${Math.round(best.winRate)}% WR (${best.wins}W-${best.losses}L)`,
        requiresDemo: false,
      });
    }
  }

  // Demo-only awards
  if (allHaveDemo) {
    const entryKing = pickBest((e) => e.avgEntryRate ?? 0);
    awards.push({ id: "entry-king", title: "Entry King", recipient: entryKing.nickname, value: `${((entryKing.avgEntryRate ?? 0) * 100).toFixed(0)}% Entry`, requiresDemo: true });

    const utilLord = pickBest((e) => e.avgUtilityDamage ?? 0);
    awards.push({ id: "utility-lord", title: "Utility Lord", recipient: utilLord.nickname, value: `${Math.round(utilLord.avgUtilityDamage ?? 0)} UD`, requiresDemo: true });

    const tradeMaster = pickBest((e) => e.avgTradeKills ?? 0);
    awards.push({ id: "trade-master", title: "Trade Master", recipient: tradeMaster.nickname, value: `${(tradeMaster.avgTradeKills ?? 0).toFixed(1)} TK`, requiresDemo: true });

    const clutchGod = pickBest((e) => e.totalClutchWins ?? 0);
    awards.push({ id: "clutch-god", title: "Clutch God", recipient: clutchGod.nickname, value: `${clutchGod.totalClutchWins ?? 0} Clutches`, requiresDemo: true });

    const flashDemon = pickBest((e) => e.avgEnemiesFlashed ?? 0);
    awards.push({ id: "flash-demon", title: "Flash Demon", recipient: flashDemon.nickname, value: `${(flashDemon.avgEnemiesFlashed ?? 0).toFixed(1)} Flashed`, requiresDemo: true });

    const econKing = pickBest((e) => e.avgEconomyEfficiency ?? 0);
    awards.push({ id: "economy-king", title: "Economy King", recipient: econKing.nickname, value: `${(econKing.avgEconomyEfficiency ?? 0).toFixed(1)} DMG/$1K`, requiresDemo: true });
  }

  return awards;
}

export function computeMapDistribution(
  matches: Array<Pick<PlayerHistoryMatch, "map" | "result">>
): MapStats[] {
  const mapData = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    const existing = mapData.get(m.map) ?? { wins: 0, losses: 0 };
    if (m.result) {
      existing.wins++;
    } else {
      existing.losses++;
    }
    mapData.set(m.map, existing);
  }

  return [...mapData.entries()]
    .map(([map, { wins, losses }]) => ({
      map,
      gamesPlayed: wins + losses,
      wins,
      losses,
      winRate: Math.round((wins / (wins + losses)) * 100),
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}

export function computeSessionStreak(
  matches: Array<Pick<PlayerHistoryMatch, "result" | "startedAt">>
): { type: "win" | "loss"; count: number } {
  const sorted = [...matches].sort((a, b) => a.startedAt - b.startedAt);
  if (sorted.length === 0) {
    return { type: "win", count: 0 };
  }

  let maxStreak = { type: "win" as "win" | "loss", count: 0 };
  let current = { type: sorted[0].result ? "win" as const : "loss" as const, count: 1 };

  for (let i = 1; i < sorted.length; i++) {
    const isWin = sorted[i].result;
    if ((isWin && current.type === "win") || (!isWin && current.type === "loss")) {
      current.count++;
    } else {
      if (current.count > maxStreak.count) {
        maxStreak = { ...current };
      }
      current = { type: isWin ? "win" : "loss", count: 1 };
    }
  }
  if (current.count > maxStreak.count) {
    maxStreak = current;
  }

  return maxStreak;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/last-party.test.ts`
Expected: PASS

- [ ] **Step 5: Run linter**

Run: `pnpm dlx ultracite check`
Expected: No errors (or fix any that appear)

- [ ] **Step 6: Commit**

```bash
git add src/lib/last-party.ts src/lib/__tests__/last-party.test.ts
git commit -m "feat(last-party): add aggregation, awards, and map distribution logic"
```

---

## Task 5: Add Server Function

**Files:**
- Modify: `src/server/matches.ts`

- [ ] **Step 1: Add `getPartySessionStats` server function**

Add at the end of `src/server/matches.ts`, before the closing of the file:

```typescript
export const getPartySessionStats = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { playerId: string; date: string }) => input
  )
  .handler(
    async ({
      data: { playerId, date },
    }): Promise<PartySessionData> => {
      const { getCalendarDayRange } = await import("~/lib/time");
      const { computeAggregateStats, computeAwards, computeMapDistribution } = await import("~/lib/last-party");

      // 1. Resolve friend list
      const targetFriendIds = await fetchPlayer(playerId)
        .then((player) => player.friendsIds)
        .catch(() => null);

      // 2. Fetch all matches for the date
      const { startUnix, endUnix } = getCalendarDayRange(date);
      const history = await fetchPlayerHistoryRange({
        faceitId: playerId,
        startUnix,
        endUnix,
      });

      // 3. Fetch stats for each match and classify queue
      const partyMatches: PlayerHistoryMatch[] = [];
      const allMatchStats: Record<string, MatchPlayerStats[]> = {};

      for (let i = 0; i < history.length; i += 5) {
        if (i > 0) {
          await sleep(BATCH_DELAY_MS);
        }
        const batch = history.slice(i, i + 5);
        const settled = await Promise.allSettled(
          batch.map(async (h: any) => {
            const stats = await fetchMatchStats(h.match_id);
            const round = stats.rounds?.[0];
            if (!round) {
              return null;
            }

            const queueInfo = classifyKnownFriendQueue({
              targetPlayerId: playerId,
              targetFriendIds,
              teams: round.teams || [],
            });

            if (queueInfo.queueBucket !== "party") {
              return null;
            }

            // Collect all players' stats for this match
            const matchPlayers: MatchPlayerStats[] = [];
            let targetPlayerMatch: PlayerHistoryMatch | null = null;

            for (const team of round.teams || []) {
              for (const player of team.players || []) {
                const parsed = parseMatchStats(player);
                matchPlayers.push(parsed);
                if (parsed.playerId === playerId) {
                  targetPlayerMatch = {
                    matchId: h.match_id,
                    map: round.round_stats?.Map || "unknown",
                    score: round.round_stats?.Score || "",
                    startedAt: h.started_at,
                    finishedAt: h.finished_at,
                    queueBucket: queueInfo.queueBucket,
                    knownQueuedFriendCount: queueInfo.knownQueuedFriendCount,
                    knownQueuedFriendIds: queueInfo.knownQueuedFriendIds,
                    partySize: queueInfo.partySize,
                    ...parsed,
                  };
                }
              }
            }

            return targetPlayerMatch
              ? { match: targetPlayerMatch, players: matchPlayers }
              : null;
          })
        );

        for (const result of settled) {
          if (result.status === "fulfilled" && result.value) {
            partyMatches.push(result.value.match);
            allMatchStats[result.value.match.matchId] = result.value.players;
          }
        }
      }

      // 4. Collect party member IDs (union across all matches)
      const partyMemberIdSet = new Set<string>();
      for (const m of partyMatches) {
        partyMemberIdSet.add(playerId);
        for (const fid of m.knownQueuedFriendIds) {
          partyMemberIdSet.add(fid);
        }
      }
      const partyMemberIds = [...partyMemberIdSet];

      // 5. Fetch demo analytics for each match
      const supabase = createServerSupabase();
      const demoMatches: Record<string, DemoMatchAnalytics> = {};
      for (const m of partyMatches) {
        const demo = await fetchDemoAnalyticsForMatch(supabase, m.matchId);
        if (demo && demo.ingestionStatus === "parsed") {
          demoMatches[m.matchId] = demo;
        }
      }
      const allHaveDemo =
        partyMatches.length > 0 &&
        partyMatches.every((m) => m.matchId in demoMatches);

      // 6. Resolve party member nicknames
      const nicknameMap = new Map<string, string>();
      for (const stats of Object.values(allMatchStats)) {
        for (const p of stats) {
          if (partyMemberIdSet.has(p.playerId)) {
            nicknameMap.set(p.playerId, p.nickname);
          }
        }
      }
      const partyMembers = partyMemberIds.map((id) => ({
        faceitId: id,
        nickname: nicknameMap.get(id) ?? id,
      }));

      // 7. Compute aggregates, awards, map distribution
      const matchIds = partyMatches.map((m) => m.matchId);
      const aggregateStats = computeAggregateStats({
        matchIds,
        matchStats: allMatchStats,
        partyMemberIds,
        demoMatches,
        allHaveDemo,
      });
      const mapDistribution = computeMapDistribution(partyMatches);
      const awards = computeAwards({
        aggregateStats,
        allHaveDemo,
        mapDistribution,
        playerId,
        date,
      });

      // 8. Compute totals
      const winCount = partyMatches.filter((m) => m.result).length;
      const lossCount = partyMatches.length - winCount;
      const totalSeconds = partyMatches.reduce((sum, m) => {
        if (m.startedAt && m.finishedAt) {
          return sum + (m.finishedAt - m.startedAt);
        }
        return sum;
      }, 0);
      const totalHoursPlayed = Math.round((totalSeconds / 3600) * 10) / 10;

      return {
        date,
        matches: partyMatches.sort((a, b) => a.startedAt - b.startedAt),
        matchStats: allMatchStats,
        demoMatches,
        allHaveDemo,
        partyMembers,
        aggregateStats,
        awards,
        mapDistribution,
        totalHoursPlayed,
        winCount,
        lossCount,
      };
    }
  );
```

Also add the import for `PartySessionData` at the top of `src/server/matches.ts`. Update the existing import from `~/lib/types` to include:

```typescript
import type {
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  LiveMatch,
  MatchPlayerStats,
  PartySessionData,
  PlayerHistoryMatch,
  StatsLeaderboardResult,
} from "~/lib/types";
```

- [ ] **Step 2: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat(last-party): add getPartySessionStats server function"
```

---

## Task 6: Add React Query Hook

**Files:**
- Create: `src/hooks/usePartySession.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from "@tanstack/react-query";
import type { PartySessionData } from "~/lib/types";
import { getPartySessionStats } from "~/server/matches";

export function usePartySession(
  playerId: string | null,
  date: string | undefined
) {
  return useQuery<PartySessionData>({
    queryKey: ["party-session", playerId, date],
    queryFn: () =>
      getPartySessionStats({ data: { playerId: playerId!, date: date! } }),
    enabled: !!playerId && !!date,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePartySession.ts
git commit -m "feat(last-party): add usePartySession React Query hook"
```

---

## Task 7: Update Navigation

**Files:**
- Modify: `src/lib/player-view-shell.ts`
- Modify: `src/routes/_authed.tsx`

- [ ] **Step 1: Update `PlayerView` type and href builder in `src/lib/player-view-shell.ts`**

Change `PlayerView` type:
```typescript
export type PlayerView = "friends" | "history" | "leaderboard" | "last-party";
```

Add case to `getPlayerViewHref` switch:
```typescript
case "last-party":
  return {
    to: "/last-party",
    search: {
      player: nickname,
    },
  };
```

Add to `getPlayerViewTabs` views array:
```typescript
{ view: "last-party", label: "Last Party" },
```

- [ ] **Step 2: Update `getCurrentNickname` in `src/routes/_authed.tsx`**

Change the pathname check on line 42 to include `/last-party`:
```typescript
if (pathname === "/history" || pathname === "/leaderboard" || pathname === "/last-party") {
```

- [ ] **Step 3: Add nav link construction and Link in `src/routes/_authed.tsx`**

After `leaderboardHref` (around line 81), add:
```typescript
const lastPartyHref = currentNickname
  ? getPlayerViewHref("last-party", currentNickname)
  : { to: "/last-party", search: { player: undefined } };
```

After the History `<Link>` (around line 149), add:
```typescript
<Link
  activeProps={{ className: navLinkActiveClass }}
  inactiveProps={{ className: navLinkInactiveClass }}
  params={lastPartyHref.params as never}
  search={lastPartyHref.search as never}
  to={lastPartyHref.to as never}
>
  Last Party
</Link>
```

- [ ] **Step 4: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/player-view-shell.ts src/routes/_authed.tsx
git commit -m "feat(last-party): add navigation link"
```

---

## Task 8: Build UI Components — Header, Awards, Stats Table

**Files:**
- Create: `src/components/last-party/LastPartyHeader.tsx`
- Create: `src/components/last-party/PartyAwards.tsx`
- Create: `src/components/last-party/SessionStatsTable.tsx`

- [ ] **Step 1: Create `LastPartyHeader.tsx`**

```typescript
import { computeSessionStreak } from "~/lib/last-party";
import type { PlayerHistoryMatch } from "~/lib/types";

interface LastPartyHeaderProps {
  date: string;
  matches: PlayerHistoryMatch[];
  winCount: number;
  lossCount: number;
  totalHoursPlayed: number;
}

export function LastPartyHeader({
  date,
  matches,
  winCount,
  lossCount,
  totalHoursPlayed,
}: LastPartyHeaderProps) {
  const streak = computeSessionStreak(matches);
  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded border border-border bg-bg-card p-4">
      <div className="mb-1 text-[10px] text-text-dim uppercase tracking-wider">
        Party Session
      </div>
      <div className="text-lg font-bold text-text">{formattedDate}</div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-text-dim">Matches </span>
          <span className="font-bold text-text">{matches.length}</span>
        </div>
        <div>
          <span className="text-accent font-bold">{winCount}W</span>
          <span className="text-text-dim"> - </span>
          <span className="text-error font-bold">{lossCount}L</span>
        </div>
        <div>
          <span className="text-text-dim">Hours </span>
          <span className="font-bold text-text">{totalHoursPlayed}h</span>
        </div>
        {streak.count >= 2 && (
          <div>
            <span className="text-text-dim">Best streak </span>
            <span
              className={`font-bold ${streak.type === "win" ? "text-accent" : "text-error"}`}
            >
              {streak.count}{streak.type === "win" ? "W" : "L"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `PartyAwards.tsx`**

```typescript
import type { SessionAward } from "~/lib/types";

interface PartyAwardsProps {
  awards: SessionAward[];
}

const AWARD_ICONS: Record<string, string> = {
  "party-mvp": "\u{1F451}",
  "party-anchor": "\u{1F480}",
  "headshot-machine": "\u{1F3AF}",
  "damage-dealer": "\u{1F4A5}",
  "map-specialist": "\u{1F5FA}",
  "entry-king": "\u{1F6AA}",
  "utility-lord": "\u{1F4A3}",
  "trade-master": "\u{1F91D}",
  "clutch-god": "\u{26A1}",
  "flash-demon": "\u{2728}",
  "economy-king": "\u{1F4B0}",
};

export function PartyAwards({ awards }: PartyAwardsProps) {
  if (awards.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Awards
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {awards.map((award) => (
          <div
            className={`rounded border border-border bg-bg-card p-3 ${
              award.id === "party-mvp"
                ? "border-accent/30 bg-accent/5"
                : award.id === "party-anchor"
                  ? "border-error/20 bg-error/5"
                  : ""
            }`}
            key={award.id}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{AWARD_ICONS[award.id] ?? "\u{1F3C6}"}</span>
              <div>
                <div className="text-[10px] text-text-dim uppercase">
                  {award.title}
                </div>
                <div className="font-bold text-sm text-text">
                  {award.recipient}
                </div>
                <div className="text-[11px] text-text-muted">{award.value}</div>
              </div>
            </div>
            {award.banter && (
              <div className="mt-2 text-[10px] text-text-muted italic">
                {award.banter}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `SessionStatsTable.tsx`**

```typescript
import type { AggregatePlayerStats } from "~/lib/types";

interface SessionStatsTableProps {
  stats: Record<string, AggregatePlayerStats>;
  allHaveDemo: boolean;
}

export function SessionStatsTable({
  stats,
  allHaveDemo,
}: SessionStatsTableProps) {
  const entries = Object.values(stats).sort((a, b) => {
    const aMetric = allHaveDemo ? (a.avgRating ?? 0) : a.avgKd;
    const bMetric = allHaveDemo ? (b.avgRating ?? 0) : b.avgKd;
    return bMetric - aMetric;
  });

  if (entries.length === 0) {
    return null;
  }

  const ratingColor = (r: number) =>
    r >= 1.2
      ? "text-yellow-400"
      : r >= 1.0
        ? "text-accent"
        : r >= 0.8
          ? "text-orange-400"
          : "text-error";

  const kdColor = (kd: number) => (kd >= 1 ? "text-accent" : "text-error/70");

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Stats
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] text-text-dim">
              <th className="py-1 text-left font-normal">Player</th>
              {allHaveDemo && (
                <>
                  <th className="px-2 py-1 text-center font-normal">RTG</th>
                  <th className="px-2 py-1 text-center font-normal">RWS</th>
                </>
              )}
              <th className="px-2 py-1 text-center font-normal">K/D</th>
              <th className="px-2 py-1 text-center font-normal">ADR</th>
              {allHaveDemo && (
                <th className="px-2 py-1 text-center font-normal">KAST%</th>
              )}
              <th className="px-2 py-1 text-center font-normal">HS%</th>
              {allHaveDemo && (
                <>
                  <th className="px-2 py-1 text-center font-normal">TK</th>
                  <th className="px-2 py-1 text-center font-normal">UD</th>
                  <th className="px-2 py-1 text-center font-normal">Entry%</th>
                </>
              )}
              <th className="px-2 py-1 text-center font-normal">K/R</th>
              <th className="px-2 py-1 text-center font-normal">MVP</th>
              <th className="px-2 py-1 text-center font-normal">GP</th>
              <th className="px-2 py-1 text-center font-normal">W</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr className="border-border border-t" key={e.faceitId}>
                <td className="py-1.5 font-semibold text-text">{e.nickname}</td>
                {allHaveDemo && (
                  <>
                    <td className={`px-2 text-center font-bold ${ratingColor(e.avgRating ?? 0)}`}>
                      {(e.avgRating ?? 0).toFixed(2)}
                    </td>
                    <td className="px-2 text-center text-text-muted">
                      {(e.avgRws ?? 0).toFixed(1)}
                    </td>
                  </>
                )}
                <td className={`px-2 text-center font-bold ${kdColor(e.avgKd)}`}>
                  {e.avgKd.toFixed(2)}
                </td>
                <td className="px-2 text-center text-text-muted">
                  {Math.round(e.avgAdr)}
                </td>
                {allHaveDemo && (
                  <td className="px-2 text-center text-text-muted">
                    {(e.avgKast ?? 0).toFixed(0)}%
                  </td>
                )}
                <td className="px-2 text-center text-text-muted">
                  {Math.round(e.avgHsPercent)}%
                </td>
                {allHaveDemo && (
                  <>
                    <td className="px-2 text-center text-text-muted">
                      {(e.avgTradeKills ?? 0).toFixed(1)}
                    </td>
                    <td className="px-2 text-center text-text-muted">
                      {Math.round(e.avgUtilityDamage ?? 0)}
                    </td>
                    <td className="px-2 text-center text-text-muted">
                      {((e.avgEntryRate ?? 0) * 100).toFixed(0)}%
                    </td>
                  </>
                )}
                <td className="px-2 text-center text-text-muted">
                  {e.avgKrRatio.toFixed(2)}
                </td>
                <td className="px-2 text-center text-text-muted">{e.totalMvps}</td>
                <td className="px-2 text-center text-text-muted">{e.gamesPlayed}</td>
                <td className="px-2 text-center text-accent">{e.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/last-party/
git commit -m "feat(last-party): add header, awards, and stats table components"
```

---

## Task 9: Build UI Components — Map Distribution, Match Accordion

**Files:**
- Create: `src/components/last-party/MapDistribution.tsx`
- Create: `src/components/last-party/MatchAccordion.tsx`

- [ ] **Step 1: Create `MapDistribution.tsx`**

```typescript
import { MAP_COLORS, mapDisplayName } from "~/lib/last-party";
import type { MapStats } from "~/lib/types";

interface MapDistributionProps {
  maps: MapStats[];
}

export function MapDistribution({ maps }: MapDistributionProps) {
  if (maps.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Maps
      </div>
      <div className="flex flex-wrap gap-2">
        {maps.map((m) => (
          <div
            className="flex items-center gap-2 rounded border border-border bg-bg-card px-3 py-2"
            key={m.map}
          >
            <div
              className={`h-3 w-3 rounded-sm ${MAP_COLORS[m.map] ?? "bg-text-dim"}`}
            />
            <span className="font-semibold text-text text-xs">
              {mapDisplayName(m.map)}
            </span>
            <span className="text-[10px] text-text-muted">
              {m.gamesPlayed}G
            </span>
            <span className="text-[10px] text-accent">{m.wins}W</span>
            <span className="text-[10px] text-error">{m.losses}L</span>
            <span className="text-[10px] text-text-dim">
              {m.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `MatchAccordion.tsx`**

```typescript
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getBanterLine } from "~/lib/banter";
import { MAP_COLORS, mapDisplayName } from "~/lib/last-party";
import type {
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  MatchPlayerStats,
  PlayerHistoryMatch,
} from "~/lib/types";

interface MatchAccordionProps {
  matches: PlayerHistoryMatch[];
  matchStats: Record<string, MatchPlayerStats[]>;
  demoMatches: Record<string, DemoMatchAnalytics>;
  partyMemberIds: string[];
}

export function MatchAccordion({
  matches,
  matchStats,
  demoMatches,
  partyMemberIds,
}: MatchAccordionProps) {
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const partySet = new Set(partyMemberIds);

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Matches
      </div>
      <div className="flex flex-col gap-1">
        {matches.map((match) => {
          const isOpen = openMatchId === match.matchId;
          const players = (matchStats[match.matchId] ?? [])
            .filter((p) => partySet.has(p.playerId))
            .sort((a, b) => b.kills - a.kills);
          const hasDemoData = match.matchId in demoMatches;
          const demoPlayers = hasDemoData ? demoMatches[match.matchId].players : [];

          const topFragger = players[0];
          const bottomFragger = players.length > 1 ? players[players.length - 1] : null;

          return (
            <div
              className="rounded border border-border bg-bg-card"
              key={match.matchId}
            >
              {/* Collapsed row */}
              <button
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs"
                onClick={() =>
                  setOpenMatchId(isOpen ? null : match.matchId)
                }
                type="button"
              >
                <div
                  className={`h-2 w-2 rounded-full ${match.result ? "bg-accent" : "bg-error"}`}
                />
                <div
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-bg ${MAP_COLORS[match.map] ?? "bg-text-dim"}`}
                >
                  {mapDisplayName(match.map)}
                </div>
                <span className="font-bold text-text">{match.score}</span>
                {hasDemoData && (
                  <span className="text-[9px] text-accent">DEMO</span>
                )}
                <span className="ml-auto text-[10px] text-text-dim">
                  {isOpen ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-border border-t px-3 pb-3 pt-2">
                  {/* Stats table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[9px] text-text-dim">
                          <th className="py-1 text-left font-normal">Player</th>
                          <th className="px-1.5 py-1 text-center font-normal">K</th>
                          <th className="px-1.5 py-1 text-center font-normal">D</th>
                          <th className="px-1.5 py-1 text-center font-normal">A</th>
                          <th className="px-1.5 py-1 text-center font-normal">K/D</th>
                          <th className="px-1.5 py-1 text-center font-normal">ADR</th>
                          <th className="px-1.5 py-1 text-center font-normal">HS%</th>
                          {hasDemoData && (
                            <>
                              <th className="px-1.5 py-1 text-center font-normal">RTG</th>
                              <th className="px-1.5 py-1 text-center font-normal">RWS</th>
                              <th className="px-1.5 py-1 text-center font-normal">KAST</th>
                              <th className="px-1.5 py-1 text-center font-normal">TK</th>
                              <th className="px-1.5 py-1 text-center font-normal">UD</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((p) => {
                          const dp = demoPlayers.find(
                            (d) =>
                              d.playerId === p.playerId ||
                              d.nickname.toLowerCase() === p.nickname.toLowerCase()
                          );
                          return (
                            <tr className="border-border border-t" key={p.playerId}>
                              <td className="py-1 font-semibold text-text">{p.nickname}</td>
                              <td className="px-1.5 text-center text-text-muted">{p.kills}</td>
                              <td className="px-1.5 text-center text-text-muted">{p.deaths}</td>
                              <td className="px-1.5 text-center text-text-muted">{p.assists}</td>
                              <td className={`px-1.5 text-center font-bold ${p.kdRatio >= 1 ? "text-accent" : "text-error/70"}`}>
                                {p.kdRatio.toFixed(2)}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">{Math.round(p.adr)}</td>
                              <td className="px-1.5 text-center text-text-muted">{p.hsPercent}%</td>
                              {hasDemoData && (
                                <>
                                  <td className={`px-1.5 text-center font-bold ${dp?.rating ? (dp.rating >= 1.2 ? "text-yellow-400" : dp.rating >= 1.0 ? "text-accent" : dp.rating >= 0.8 ? "text-orange-400" : "text-error") : "text-text-dim"}`}>
                                    {dp?.rating?.toFixed(2) ?? "-"}
                                  </td>
                                  <td className="px-1.5 text-center text-text-muted">{dp?.rws?.toFixed(1) ?? "-"}</td>
                                  <td className="px-1.5 text-center text-text-muted">{dp?.kastPercent ? `${dp.kastPercent.toFixed(0)}%` : "-"}</td>
                                  <td className="px-1.5 text-center text-text-muted">{dp?.tradeKills ?? "-"}</td>
                                  <td className="px-1.5 text-center text-text-muted">{dp?.utilityDamage ?? "-"}</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Banter */}
                  {topFragger && bottomFragger && (
                    <div className="mt-2 border-border border-t pt-2 text-center">
                      <span className="text-[11px] text-text-muted italic">
                        {getBanterLine("carry", topFragger.nickname, match.matchId)}
                        {". "}
                        {getBanterLine("roast", bottomFragger.nickname, match.matchId)}
                        {"."}
                      </span>
                    </div>
                  )}

                  {/* Link to full match */}
                  <div className="mt-2 text-center">
                    <Link
                      className="text-[10px] text-accent hover:underline"
                      params={{ matchId: match.matchId }}
                      to="/match/$matchId"
                    >
                      View full match details &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/last-party/MapDistribution.tsx src/components/last-party/MatchAccordion.tsx
git commit -m "feat(last-party): add map distribution and match accordion components"
```

---

## Task 10: Build Session Analyst Component (Demo-Only)

**Files:**
- Create: `src/components/last-party/SessionAnalyst.tsx`

- [ ] **Step 1: Create `SessionAnalyst.tsx`**

```typescript
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { AggregatePlayerStats } from "~/lib/types";

interface SessionAnalystProps {
  stats: Record<string, AggregatePlayerStats>;
}

const ACCENT_COLORS = [
  "#00ff88",
  "#ff4444",
  "#44aacc",
  "#cc9944",
  "#aa77cc",
  "#77aa55",
];

function normalize(value: number, max: number): number {
  return max > 0 ? Math.min((value / max) * 100, 100) : 0;
}

export function SessionAnalyst({ stats }: SessionAnalystProps) {
  const entries = Object.values(stats);
  if (entries.length === 0) {
    return null;
  }

  // Compute max values for normalization
  const maxKills = Math.max(...entries.map((e) => e.avgKd));
  const maxAdr = Math.max(...entries.map((e) => e.avgAdr));
  const maxKast = Math.max(...entries.map((e) => e.avgKast ?? 0));
  const maxHs = Math.max(...entries.map((e) => e.avgHsPercent));
  const maxEntry = Math.max(...entries.map((e) => e.avgEntryRate ?? 0));
  const maxTrade = Math.max(...entries.map((e) => e.avgTradeKills ?? 0));

  const radarData = [
    { axis: "K/D", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgKd, maxKills)])) },
    { axis: "ADR", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgAdr, maxAdr)])) },
    { axis: "KAST", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgKast ?? 0, maxKast)])) },
    { axis: "HS%", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgHsPercent, maxHs)])) },
    { axis: "Entry", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgEntryRate ?? 0, maxEntry)])) },
    { axis: "Trades", ...Object.fromEntries(entries.map((e) => [e.nickname, normalize(e.avgTradeKills ?? 0, maxTrade)])) },
  ];

  // Session aggregates
  const totalTradeKills = entries.reduce((s, e) => s + (e.avgTradeKills ?? 0) * e.gamesPlayed, 0);
  const totalUtilDmg = entries.reduce((s, e) => s + (e.avgUtilityDamage ?? 0) * e.gamesPlayed, 0);
  const avgKast = entries.reduce((s, e) => s + (e.avgKast ?? 0), 0) / entries.length;
  const avgRating = entries.reduce((s, e) => s + (e.avgRating ?? 0), 0) / entries.length;
  const avgEconEfficiency = entries.reduce((s, e) => s + (e.avgEconomyEfficiency ?? 0), 0) / entries.length;

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Analyst
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Radar chart */}
        <div className="rounded border border-border bg-bg-card p-4">
          <ResponsiveContainer height={300} width="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1a1a1a" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "#888888", fontSize: 10 }}
              />
              {entries.map((e, i) => (
                <Radar
                  dataKey={e.nickname}
                  fill={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  fillOpacity={0.1}
                  key={e.faceitId}
                  name={e.nickname}
                  stroke={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  strokeWidth={2}
                />
              ))}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #1a1a1a",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Team aggregates */}
        <div className="rounded border border-border bg-bg-card p-4">
          <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
            Session Totals
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-dim">Avg Rating</div>
              <div className="font-bold text-lg text-accent">
                {avgRating.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Avg KAST%</div>
              <div className="font-bold text-lg text-text">
                {avgKast.toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-text-dim">Total Trade Kills</div>
              <div className="font-bold text-lg text-text">
                {Math.round(totalTradeKills)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Total Utility DMG</div>
              <div className="font-bold text-lg text-text">
                {Math.round(totalUtilDmg)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Avg Spend Efficiency</div>
              <div className="font-bold text-lg text-text">
                {avgEconEfficiency.toFixed(1)} DMG/$1K
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/last-party/SessionAnalyst.tsx
git commit -m "feat(last-party): add session analyst radar chart component"
```

---

## Task 11: Build Route Page

**Files:**
- Create: `src/routes/_authed/last-party.tsx`

- [ ] **Step 1: Create the route file**

```typescript
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LastPartyHeader } from "~/components/last-party/LastPartyHeader";
import { MapDistribution } from "~/components/last-party/MapDistribution";
import { MatchAccordion } from "~/components/last-party/MatchAccordion";
import { PartyAwards } from "~/components/last-party/PartyAwards";
import { SessionAnalyst } from "~/components/last-party/SessionAnalyst";
import { SessionStatsTable } from "~/components/last-party/SessionStatsTable";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { usePartySession } from "~/hooks/usePartySession";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import { getYesterdayDateString } from "~/lib/time";
import { resolvePlayer } from "~/server/friends";

export const Route = createFileRoute("/_authed/last-party")({
  validateSearch: (search: Record<string, unknown>) => ({
    player:
      typeof search.player === "string" && search.player.length > 0
        ? search.player
        : undefined,
    date:
      typeof search.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
  }),
  component: LastPartyPage,
});

function LastPartyPage() {
  const navigate = useNavigate();
  const { player: urlPlayer, date: urlDate } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");
  const [dateInput, setDateInput] = useState(urlDate ?? getYesterdayDateString());

  const {
    data: player,
    isLoading: resolving,
    isError: resolveError,
  } = useQuery({
    queryKey: ["resolve-player", urlPlayer],
    queryFn: () => resolvePlayer({ data: urlPlayer! }),
    enabled: !!urlPlayer,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const effectiveDate = urlDate ?? getYesterdayDateString();

  const {
    data: session,
    isLoading: sessionLoading,
  } = usePartySession(player?.faceitId ?? null, effectiveDate);

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  useEffect(() => {
    setDateInput(urlDate ?? getYesterdayDateString());
  }, [urlDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) {
      return;
    }
    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }
    navigate({
      to: "/last-party",
      search: { player: target.value, date: dateInput },
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateInput(newDate);
    if (urlPlayer) {
      navigate({
        to: "/last-party",
        search: { player: urlPlayer, date: newDate },
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        error={resolveError ? "Player not found." : null}
        onSubmit={handleSearch}
        onValueChange={setInput}
        placeholder="FACEIT nickname, profile link, or player UUID..."
        value={input}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {/* Date picker */}
          <div className="flex items-center gap-3 text-xs">
            <label className="text-text-dim" htmlFor="party-date">
              Date
            </label>
            <input
              className="rounded border border-border bg-bg-elevated px-3 py-1.5 text-text"
              id="party-date"
              max={getYesterdayDateString()}
              onChange={handleDateChange}
              type="date"
              value={dateInput}
            />
          </div>

          {/* Loading */}
          {(resolving || sessionLoading) && urlPlayer && (
            <div className="animate-pulse py-8 text-center text-accent">
              Loading party session...
            </div>
          )}

          {/* Empty state */}
          {session && session.matches.length === 0 && (
            <div className="py-12 text-center text-text-dim">
              No party matches found on this date.
            </div>
          )}

          {/* No player */}
          {!urlPlayer && !resolving && (
            <div className="py-12 text-center text-text-dim">
              Enter a nickname or UUID to view party session recap.
            </div>
          )}

          {/* Session content */}
          {session && session.matches.length > 0 && (
            <>
              <LastPartyHeader
                date={session.date}
                lossCount={session.lossCount}
                matches={session.matches}
                totalHoursPlayed={session.totalHoursPlayed}
                winCount={session.winCount}
              />
              <PartyAwards awards={session.awards} />
              <SessionStatsTable
                allHaveDemo={session.allHaveDemo}
                stats={session.aggregateStats}
              />
              <MapDistribution maps={session.mapDistribution} />
              <MatchAccordion
                demoMatches={session.demoMatches}
                matchStats={session.matchStats}
                matches={session.matches}
                partyMemberIds={session.partyMembers.map((p) => p.faceitId)}
              />
              {session.allHaveDemo && (
                <SessionAnalyst stats={session.aggregateStats} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run linter and fix**

Run: `pnpm dlx ultracite fix`
Expected: Auto-fixes applied

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/last-party.tsx
git commit -m "feat(last-party): add route page with full session recap UI"
```

---

## Task 12: Build and Smoke Test

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run linter check**

Run: `pnpm dlx ultracite check`
Expected: No errors

- [ ] **Step 4: Fix any issues found in steps 1-3**

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(last-party): address build/lint issues"
```
