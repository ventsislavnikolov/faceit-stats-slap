# Squad Match Experience Design

## Overview

Enhance the LiveMatchCard to better serve the "5 friends playing together" scenario with party detection, post-match scoreboard, and playful banter.

## Constraints

- FACEIT `/matches/{id}/stats` endpoint only returns per-player stats after the match finishes (404 during ONGOING)
- During a live match, only round scores and team rosters are available
- Post-match stats include: Kills, Deaths, Assists, K/D, ADR, HS%, MVPs, Triple/Quadro/Penta Kills

## Feature 1: Party Detection Badge

**When**: 3+ friends are in the same match (determined by `match.friendIds.length >= 3`).

**What**: A green "Party (N)" badge rendered next to the `MapBadge` in the `LiveMatchCard` header.

**Threshold**: 3 friends minimum. Two friends in the same match is common enough to not warrant a badge; three or more signals an intentional party.

**Component**: Inline in `LiveMatchCard` — no new component needed. Simple conditional render:
```
{match.friendIds.length >= 3 && <span>Party ({match.friendIds.length})</span>}
```

**Styling**: Same shape as `MapBadge` — `bg-accent/15 text-accent text-[10px] px-2 py-0.5 rounded font-semibold`.

## Feature 2: Post-Match Inline Scoreboard

### Trigger

When `match.status === "FINISHED"`, the LiveMatchCard transitions from its current live layout to an expanded post-match layout.

### Data Flow

1. New hook: `useMatchStats(matchId: string, enabled: boolean)`
   - Calls existing `getMatchDetails` server function
   - `enabled` is `true` only when `match.status === "FINISHED"`
   - Returns `MatchWithStats` (already typed) containing `players: MatchPlayerStats[]`
   - `staleTime: Infinity` — stats don't change after match ends

2. Filter players to friends only using `match.friendIds`
3. Sort by kills descending

### Layout (Post-Match Card)

```
+-----------------------------------------------+
| FINISHED  [de_inferno] [Party (5)]       WIN   |
|                                                 |
|      F1aw1esss   16  -  11   PapiHype          |
|                                                 |
| ─── Your Squad ──────────────────────────────── |
|      K   D   A   K/D   ADR  HS%  MVP           |
| 👑 F1aw1esss  28  14  5  2.00  98  42%  5      | <- green bg
|  2 pRoXx--    22  16  3  1.38  85  36%  3      |
|  3 soavarice  18  15  7  1.20  78  33%  2      |
|  4 FeriBo     14  17  4  0.82  65  28%  1      |
| 💀 eLfen0men0  9  19  2  0.47  45  22%  0      | <- dimmed bg
|                                                 |
| [F1aw1esss: 2x Triple, 1x Quadro]              |
| ─────────────────────────────────────────────── |
| "F1aw1esss carried harder than a shopping bag.  |
|  eLfen0men0 was the team's emotional support."  |
+-----------------------------------------------+
```

### Card State Machine

```
ONGOING/READY/VOTING/CONFIGURING -> current LiveMatchCard (unchanged)
FINISHED -> expanded post-match card with scoreboard
```

The transition happens naturally: `useLiveMatches` polls every 30s. When FACEIT returns `FINISHED`, the `LiveMatch.status` updates, and the card re-renders with the new layout. The `useMatchStats` hook fires to fetch per-player stats.

### Scoreboard Details

- **Columns**: K, D, A, K/D, ADR, HS%, MVP
- **Sort**: By kills descending
- **Top fragger** (rank 1): Crown emoji, row background `bg-accent/8`, name in `text-accent`
- **Bottom fragger** (last rank): Skull emoji, row background `bg-error/5`, name and stats in `text-text-muted`
- **Middle ranks**: Numbered (2, 3, 4...), default text colors
- **K/D coloring**: >= 1.0 is `text-accent`, < 1.0 is `text-error/70`
- **Multi-kill badges**: Shown below the table only for players who have triple/quadro/penta kills > 0. Format: `"{name}: Nx Triple, Nx Quadro"`. Styled as small accent-tinted pills.

### New Component

`PostMatchScoreboard` — receives `friendIds: string[]` and `players: MatchPlayerStats[]`, handles filtering, sorting, and rendering the table + multi-kill badges.

### Win/Loss Indicator

Top-right of the card header: "WIN" in `text-accent` or "LOSS" in `text-error` based on whether the friend faction won (compare faction scores).

## Feature 3: Playful Banter

### Architecture

```typescript
// src/lib/banter.ts
type BanterType = "carry" | "roast";

function getBanterLine(type: BanterType, name: string): string
```

Contains two arrays of template strings with `{name}` placeholder:
- `CARRY_LINES`: ~15 templates for the top fragger
- `ROAST_LINES`: ~15 templates for the bottom fragger

Random selection using `Math.random()`. Deterministic per match by seeding with `matchId.charCodeAt()` sum so the same match always shows the same banter (avoids flickering on re-render).

### Example Lines

**Carry**:
- "{name} carried harder than a shopping bag"
- "{name} turned the server into a highlight reel"
- "The other team is still looking for {name}"
- "{name} chose violence today"
- "Rename the match to the {name} show"

**Roast**:
- "{name} was the team's emotional support"
- "{name} brought good vibes instead of aim"
- "{name} was just there for the company"
- "At least {name} had fun... right?"
- "{name} played like their monitor was off"

### Display

Shown at the bottom of the post-match card, below a top border. Italic, muted color (`text-text-muted`), centered. Two sentences: one carry, one roast.

### Future LLM Swap

The `getBanterLine` function is the single integration point. To add LLM generation later:
1. Make it async: `async function getBanterLine(...)`
2. Call an LLM API with player stats context
3. Fall back to templates on error/timeout

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/PostMatchScoreboard.tsx` | Scoreboard table + multi-kill badges |
| `src/lib/banter.ts` | Banter template system |
| `src/hooks/useMatchStats.ts` | Hook wrapping `getMatchDetails` for finished matches |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/LiveMatchCard.tsx` | Add party badge, branch on status for post-match layout |
| `src/lib/types.ts` | No changes needed — all types already exist |
| `src/server/matches.ts` | No changes needed — `getMatchDetails` already exists |

## Out of Scope

- Live in-match per-player stats (API limitation)
- Full 10-player scoreboard (friends-only by design choice)
- LLM-generated banter (deferred, architecture supports it)
- Browser notifications
- MVP highlight beyond the crown icon
