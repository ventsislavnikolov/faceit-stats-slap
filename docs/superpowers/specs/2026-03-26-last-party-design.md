# Last Party — Session Recap Page

## Overview

A new route `/last-party` that shows a comprehensive, entertainment-focused recap of a player's party session on a specific day. Combines full statistical depth with fun awards and banters.

## Input

- **Player search**: Nickname, UUID, or profile link (reuses `PlayerSearchHeader`)
- **Date picker**: Calendar single-day selector, defaults to yesterday. Uses `react-day-picker` for accessible keyboard navigation and ARIA support. The selected date is a `YYYY-MM-DD` string interpreted in `APP_TIME_ZONE` (Europe/Sofia), consistent with `getPreviousCalendarDayRange`.
- No queue filter — this page is exclusively for party matches

## Data Flow

1. Resolve player via existing `resolvePlayer` / `fetchPlayerByNickname`
2. Resolve friend list via `searchAndLoadFriends` to get the player's FACEIT friends
3. Fetch all matches for that player on the selected date (using `fetchPlayerHistoryRange` internally within `src/server/matches.ts`, with start/end unix timestamps computed from the selected date in `APP_TIME_ZONE`)
4. Classify each match using `classifyKnownFriendQueue` with the resolved friend list — filter to party matches only (`queueBucket === "party"`, i.e. player + 2+ known friends on the same team, per `PARTY_FRIEND_THRESHOLD`)
5. For each party match, fetch per-match stats for all players via `fetchMatchStats` (batched, lazy-loaded on accordion expand for performance) + check Supabase for demo analytics via `fetchDemoAnalyticsForMatch`
6. **Demo prioritization**: If ALL party matches have parsed demo data (`ingestionStatus === "parsed"`), use demo stats as the primary data source for aggregates, awards, and per-match display. Fall back to FACEIT stats only when some matches lack demos.

**Note**: `fetchPlayerHistoryRange` and `fetchDemoAnalyticsForMatch` are private helpers in `src/server/matches.ts`. The new `getPartySessionStats` server function should be co-located in the same file to access them directly.

## Page Layout

### 1. Session Header

- Selected date
- Total party matches played
- Win/Loss record (e.g. "5W - 2L")
- Total hours played
- Longest win/loss streak within the session

### 2. Awards Section

The showpiece of the page. Fun superlatives awarded across all matches in the session.

**Always shown (FACEIT stats):**

| Award | Criteria | Banter |
|-------|----------|--------|
| Party MVP | Highest avg K/D (or Rating if demo) | Session carry banter |
| Party Anchor | Lowest avg K/D (or Rating if demo) | Session roast banter |
| Headshot Machine | Highest HS% | — |
| Damage Dealer | Highest ADR | — |
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

**Tiebreaker**: Ties broken by alphabetical nickname order (ascending) for deterministic results.

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
**Expanded** (stats fetched lazily on expand for performance):
- Full stats table for all party members in that match
- If demo exists for that match: show advanced columns inline (Rating, RWS, KAST, TK, UD)
- Carry banter (top fragger) + Roast banter (bottom fragger) using existing deterministic banter system
- Link to `/match/$matchId` for full detail view

### 6. Session Analyst (only when ALL matches have demo data)

- Combined radar chart comparing all party members across the session (axes: Kills, ADR, KAST, HS%, Entry kills, Trade kills). Uses Recharts (already available via `AnalystDashboard`).
- Team-compare style aggregates: total trade kills, total utility damage, avg KAST%, avg rating
- Economy overview: avg spend efficiency across the session

## States

- **Loading**: Skeleton placeholders for header + awards + table while fetching session data
- **Error**: "Player not found" or "Failed to load session data" with retry button (same pattern as history page)
- **Empty**: "No party matches found on this date" message with suggestion to try another date
- **Partial loading**: Session header and aggregate stats load first; per-match accordion details load lazily on expand

## Components

### New Components

- `LastPartyHeader` — Session summary (date, W/L, hours, streak)
- `PartyAwards` — Awards section with superlatives
- `SessionStatsTable` — Aggregate stats table (handles demo/no-demo columns)
- `MapDistribution` — Map breakdown visual
- `MatchAccordion` — Per-match expandable rows with stats + banter (lazy-loads per-match details)
- `SessionAnalyst` — Radar charts and team aggregates (demo-only, uses Recharts)
- `DatePicker` — Calendar single-day selector using `react-day-picker` library for accessibility (keyboard navigation, ARIA labels, screen reader support)

### Reused Components

- `PlayerSearchHeader` — Player input form
- Banter system from `lib/banter.ts` — Per-match carry/roast lines
- Map color scheme from existing theme
- Stats color coding (K/D, Rating thresholds)

### New Banter Lines

Session-level banter lines for Party MVP and Party Anchor (separate from per-match banters). These are triggered by session aggregate performance, not individual match performance. Hash seed for deterministic selection: `playerId + date` (e.g. `"abc123-2026-03-25" + "carry"`), ensuring the same session always produces the same banter.

## Server Functions

### New

- `getPartySessionStats(playerId, date)` — Defined in `src/server/matches.ts` alongside existing private helpers. Fetches all matches in date range, resolves friend list, classifies queue buckets, filters to party only, aggregates stats, fetches demo data where available.
- Returns: `{ matches: PlayerHistoryMatch[], demoMatches: Record<string, DemoMatchAnalytics>, allHaveDemo: boolean, partyMembers: Pick<FaceitPlayer, "faceitId" | "nickname">[], aggregateStats: Record<string, AggregatePlayerStats>, awards: SessionAward[], mapDistribution: MapStats[], totalHoursPlayed: number, winCount: number, lossCount: number }`

### Internal helpers used (private, co-located in matches.ts)

- `fetchPlayerHistoryRange` — Fetch matches in date range
- `fetchDemoAnalyticsForMatch` — Demo data per match
- `classifyKnownFriendQueue` — Party classification

### Reused (exported)

- `resolvePlayer` — Player resolution
- `searchAndLoadFriends` — Friend list resolution

## Types

```typescript
interface PartySessionData {
  date: string
  matches: PlayerHistoryMatch[]
  demoMatches: Record<string, DemoMatchAnalytics>
  allHaveDemo: boolean
  partyMembers: Pick<FaceitPlayer, "faceitId" | "nickname">[]
  aggregateStats: Record<string, AggregatePlayerStats>
  awards: SessionAward[]
  mapDistribution: MapStats[]
  totalHoursPlayed: number
  winCount: number
  lossCount: number
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
  validateSearch: (search: Record<string, unknown>) => ({
    player:
      typeof search.player === "string" && search.player.length > 0
        ? search.player
        : undefined,
    date:
      typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
  }),
})
```

## Navigation

Add "Last Party" link to the navigation bar in `_authed.tsx`, following the same pattern as `historyHref` and `leaderboardHref`:

- Construct `lastPartyHref` using `getCurrentNickname` to pre-fill `?player=` when a player is in context
- Update `getCurrentNickname` to recognize the `/last-party` path
- Active-state styling follows the existing `isActive` pattern for nav links

## Edge Cases

- **No party matches on selected date**: Show empty state message "No party matches found on this date"
- **Only 1 match**: Awards still shown but Map Specialist hidden
- **Player not found**: Same error handling as history page
- **Demo data partially available**: Use FACEIT stats for aggregates, show demo indicator per match in accordion, hide Session Analyst and demo-only awards
- **All friends left mid-session**: Party members list is union of all friends across all matches (not intersection)
- **URL sharing**: `/last-party?player=foo&date=2026-03-25` works for any user, but party classification depends on the searched player's friend list (not the viewer's). This is expected behavior — you're viewing that player's party session.
