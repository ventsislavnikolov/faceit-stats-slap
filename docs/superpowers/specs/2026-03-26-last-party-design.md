# Last Party — Session Recap Page

## Overview

A new route `/last-party` that shows a comprehensive, entertainment-focused recap of a player's party session on a specific day. Combines full statistical depth with fun awards and banters.

## Input

- **Player search**: Nickname, UUID, or profile link (reuses `PlayerSearchHeader`)
- **Date picker**: Calendar single-day selector, defaults to yesterday
- No queue filter — this page is exclusively for party matches

## Data Flow

1. Resolve player via existing `resolvePlayer` / `fetchPlayerByNickname`
2. Fetch all matches for that player on the selected date (using `fetchPlayerHistoryRange` with start/end unix timestamps for the chosen day)
3. Filter to party matches only (`queueBucket === "party"`, i.e. 3+ known friends)
4. For each match, fetch full stats + check Supabase for demo analytics
5. Resolve friend list to identify party members
6. **Demo prioritization**: If ALL matches have parsed demo data, use demo stats as the primary data source for aggregates, awards, and per-match display. Fall back to FACEIT stats only when some matches lack demos.

## Page Layout

### 1. Session Header

- Selected date
- Total party matches played
- Win/Loss record (e.g. "5W - 2L")
- Total hours played
- Win/loss streak indicator (if applicable)

### 2. Awards Section

The showpiece of the page. Fun superlatives awarded across all matches in the session.

**Always shown (FACEIT stats):**

| Award | Criteria | Banter |
|-------|----------|--------|
| Party MVP | Highest avg K/D (or Rating if demo) | Session carry banter |
| Party Anchor | Lowest avg K/D (or Rating if demo) | Session roast banter |
| Headshot Machine | Highest HS% | — |
| The Wall | Highest ADR | — |
| Map Specialist | Best win rate on a specific map (only if 2+ maps played) | — |

**Demo-only awards (shown when ALL matches have demo data):**

| Award | Criteria |
|-------|----------|
| Entry King | Most avg first kills |
| Utility Lord | Highest avg utility damage |
| Trade Master | Most avg trade kills |
| Clutch God | Most clutch wins |
| Flash Demon | Most enemies flashed |
| Economy King | Best damage per $1000 spent |

Awards use session-level banter lines for MVP and Anchor. Per-match banters are shown in the accordion section below.

### 3. Aggregate Stats Table

All party members' averaged stats across the session.

**Without demo data:**

| Player | K/D | ADR | HS% | K/R | MVPs | 3K | 4K | 5K |

**With demo data (all matches)** — demo columns become primary:

| Player | Rating | RWS | K/D | ADR | KAST% | HS% | TK | UD | Entry% | K/R | MVPs |

- Rating: color-coded (gold >= 1.2, green >= 1.0, orange >= 0.8, red < 0.8)
- K/D: green >= 1, red < 1

### 4. Map Distribution

- Maps played with count and win rate per map
- Color-coded using existing map color scheme (Inferno brown, Dust2 tan, Nuke blue, etc.)
- Visual bar or badge per map

### 5. Per-Match Accordion

Each match as a collapsible row:

**Collapsed**: Map badge, score, W/L indicator, match duration
**Expanded**:
- Full stats table for all party members in that match
- If demo exists for that match: show advanced columns inline (Rating, RWS, KAST, TK, UD)
- Carry banter (top fragger) + Roast banter (bottom fragger) using existing deterministic banter system
- Link to `/match/$matchId` for full detail view

### 6. Session Analyst (only when ALL matches have demo data)

- Combined radar chart comparing all party members across the session (axes: Kills, ADR, KAST, HS%, Entry kills, Trade kills)
- Team-compare style aggregates: total trade kills, total utility damage, avg KAST%, avg rating
- Economy overview: avg spend efficiency across the session

## Components

### New Components

- `LastPartyHeader` — Session summary (date, W/L, hours)
- `PartyAwards` — Awards section with superlatives
- `SessionStatsTable` — Aggregate stats table (handles demo/no-demo columns)
- `MapDistribution` — Map breakdown visual
- `MatchAccordion` — Per-match expandable rows with stats + banter
- `SessionAnalyst` — Radar charts and team aggregates (demo-only)
- `DatePicker` — Calendar single-day selector

### Reused Components

- `PlayerSearchHeader` — Player input form
- Banter system from `lib/banter.ts` — Per-match carry/roast lines
- Map color scheme from existing theme
- Stats color coding (K/D, Rating thresholds)

### New Banter Lines

Session-level banter lines for Party MVP and Party Anchor (separate from per-match banters). These are triggered by session aggregate performance, not individual match performance.

## Server Functions

### New

- `getPartySessionStats(playerId, dateStart, dateEnd)` — Fetches all matches in date range, filters to party only, aggregates stats, fetches demo data where available
- Returns: `{ matches: PlayerHistoryMatch[], demoMatches: Map<matchId, DemoMatchAnalytics>, allHaveDemo: boolean, partyMembers: string[], aggregateStats: AggregateStats }`

### Reused

- `resolvePlayer` — Player resolution
- `fetchPlayerHistoryRange` — Fetch matches in date range
- `fetchDemoAnalyticsForMatch` — Demo data per match
- `searchAndLoadFriends` — Friend list resolution

## Types

```typescript
interface PartySessionData {
  date: string
  matches: PlayerHistoryMatch[]
  demoMatches: Map<string, DemoMatchAnalytics>
  allHaveDemo: boolean
  partyMembers: PartyMember[]
  aggregateStats: Map<string, AggregatePlayerStats>
  awards: SessionAward[]
  mapDistribution: MapStats[]
  totalHoursPlayed: number
  winCount: number
  lossCount: number
}

interface PartyMember {
  faceitId: string
  nickname: string
}

interface AggregatePlayerStats {
  // Always available (FACEIT)
  avgKd: number
  avgAdr: number
  avgHsPercent: number
  avgKrRatio: number
  totalMvps: number
  totalTripleKills: number
  totalQuadroKills: number
  totalPentaKills: number
  gamesPlayed: number
  wins: number
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

interface SessionAward {
  id: string           // e.g. "party-mvp", "headshot-machine"
  title: string        // Display name
  recipient: string    // nickname
  value: string        // e.g. "1.45 Rating", "68% HS"
  banter?: string      // Session banter line (MVP/Anchor only)
  requiresDemo: boolean
}

interface MapStats {
  map: string
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
}
```

## Route Definition

```typescript
// src/routes/_authed/last-party.tsx
export const Route = createFileRoute("/_authed/last-party")({
  validateSearch: (search) => ({
    player: search.player as string | undefined,
    date: search.date as string | undefined,  // YYYY-MM-DD format
  }),
})
```

## Navigation

Add "Last Party" link to the navigation bar in `_authed.tsx`, alongside Friends, Leaderboard, History.

## Edge Cases

- **No party matches on selected date**: Show empty state message "No party matches found on this date"
- **Only 1 match**: Awards still shown but some (Map Specialist) hidden
- **Player not found**: Same error handling as history page
- **Demo data partially available**: Use FACEIT stats for aggregates, show demo indicator per match in accordion, hide Session Analyst and demo-only awards
- **All friends left mid-session**: Party members list is union of all friends across all matches (not intersection)
