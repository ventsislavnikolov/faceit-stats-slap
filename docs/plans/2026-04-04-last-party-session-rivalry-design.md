# Last Party Session Rivalry Design

## Overview

Add a session-local competitive layer to `/last-party` that turns a party recap into a verdict on who actually owned the session.

The current page already aggregates party matches, awards, demo analytics, and per-match breakdowns. This design adds a **Session Rivalry Engine** that produces:

- a ranked session podium
- explainable session scores per player
- direct rivalry storylines between party members
- evidence-backed callouts that work with FACEIT-only data and improve when full demo coverage exists

This feature should answer one question clearly: **who won the night, and why?**

## Product Goals

- Make `Last Party` feel more competitive without losing the social recap energy
- Keep the verdict scoped to a single selected session, not a global ranking system
- Prefer explainable scoring over black-box formulas
- Degrade cleanly when demo data is partial or unavailable
- Reuse the existing `getPartySessionStats` pipeline and avoid schema changes for v1

## Non-Goals

- No persistent cross-session ELO or power ranking
- No database writes or stored rivalry history
- No AI-generated analysis for v1
- No hidden weighting model that users cannot inspect

## Core Concept

Introduce a **Session Rivalry Engine** that runs after session aggregation and produces three outputs:

1. `podium`
2. `rivalryCards`
3. `sessionScoreBreakdowns`

Each party member receives a **Session Score** computed from a small set of weighted categories. The UI presents the ranking, the reasons behind it, and a handful of direct head-to-head stories that summarize the session.

The page should remain honest:

- FACEIT-only sessions use simpler combat and win-impact signals
- full-demo sessions unlock richer tactical categories
- partial-demo sessions fall back to FACEIT-safe calculations instead of guessing missing data

## User Experience

### Placement In The Page

Insert the rivalry layer into `/last-party` in this order:

1. Session header
2. Session podium
3. Rivalry cards
4. Aggregate stats table
5. Awards
6. Map distribution
7. Per-match accordion
8. Session analyst

### Session Podium

Add a headline block that shows the top three players for the selected session:

- rank position
- nickname
- Session Score
- one-line verdict
- badge derived from strongest or weakest category

Example badge styles:

- `Carry`
- `Closer`
- `Stabilizer`
- `Entry King`
- `Fraud Watch`

The podium is the fastest read on the page and should answer the session outcome before the user reads tables.

### Rivalry Cards

Show three to four cards summarizing the strongest storylines from the session:

- `Owned the lobby`: highest Session Score with strongest margin
- `Closest duel`: two players with nearly identical scores
- `Head-to-head winner`: strongest record over another player across shared maps
- `Feast or famine`: highest variance between best and worst map

These cards should feel evidence-based, not gimmicky. Each card needs a short explanation using visible numbers.

### Aggregate Table Upgrade

Add `Session Score` as the first numeric column in the aggregate stats table. Keep the rest of the table intact so users still see familiar raw stats. Expandable player evidence should show:

- category score breakdown
- best map
- worst map
- strongest reason
- weakest category

### Match Accordion Support

Each expanded match row should include a compact rivalry strip:

- best party player for that map
- weakest party player for that map
- optional `swing player` tag for the player whose map score most exceeded their session average

This keeps the rivalry language consistent across the whole page.

## Scoring Model

### Principles

- Prefer transparent weighted categories
- Keep categories stable enough that users can learn the system
- Show the breakdown in the UI
- Use deterministic tiebreakers

### FACEIT-Only Categories

Use a base scoring model when demo data is not fully available:

- `combatImpact`: K/D, ADR, K/R, HS%
- `winningImpact`: win contribution across party matches
- `consistency`: frequency of finishing above the session median on key metrics
- `popOff`: standout best-map peaks and multi-kill spikes

### Demo-Enhanced Categories

When all matches have parsed demo analytics, extend the model with:

- `entryEdge`
- `tradeValue`
- `clutchValue`
- `utilityValue`
- `economyEdge`

Suggested source metrics:

- rating
- RWS
- entry kills and entry rate
- trade kills
- clutch wins
- utility damage
- enemies flashed
- economy efficiency

### Score Output

Each player gets:

- `sessionScore`
- `categoryScores`
- `topReasons`
- `weakestCategory`

The page should never present only the total. The supporting reasons are required.

### Tiebreakers

Use deterministic ordering:

1. higher `sessionScore`
2. more category wins
3. better head-to-head result
4. alphabetical nickname ascending

## Rivalry Logic

### Head-To-Head Comparisons

Direct rivalries should be computed only from matches shared within the selected session.

For each player pair:

- count maps where player A outscored player B
- compare average map score across shared maps
- detect whether one player won the higher-stakes maps, such as the team wins

This allows stronger callouts than raw averages alone.

### Storyline Selection

Pick the best rivalry cards from the computed outputs rather than generating them ad hoc in the UI.

Candidate storylines:

- widest podium margin
- closest overall duel
- strongest head-to-head domination
- highest variance player
- biggest late-session recovery if a useful signal exists from match order

If the sample is too small, suppress fragile claims rather than exaggerating.

## Data Flow

### Server Pipeline

Extend `getPartySessionStats` in [src/server/matches.ts](/Users/ventsislavnikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/server/matches.ts) with a final read-only stage:

1. resolve player
2. resolve friends
3. fetch date-range matches
4. filter to party matches
5. fetch per-match stats and optional demo analytics
6. compute existing aggregate session data
7. run `buildSessionRivalries(sessionData)`

### New Helper

Add a pure helper, likely under [src/lib/last-party.ts](/Users/ventsislavnikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/lib/last-party.ts), responsible for:

- building normalized category scores
- computing player session scores
- deriving head-to-head summaries
- choosing the podium
- choosing rivalry cards

This helper should not perform any I/O.

### Returned Shape

Extend the session response with something like:

```ts
interface SessionRivalryData {
  podium: SessionPodiumEntry[];
  rivalryCards: SessionRivalryCard[];
  playerBreakdowns: Record<string, SessionScoreBreakdown>;
}
```

## Components

### New Components

- `SessionPodium`
- `SessionRivalryCards`
- `SessionScoreBadge` or similar small presentational helper
- `PlayerSessionBreakdown` for the expandable evidence drawer

### Existing Components To Update

- [src/routes/_authed/last-party.tsx](/Users/ventsislavnikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/last-party.tsx)
- `SessionStatsTable`
- `MatchAccordion`

### Visual Direction

- Keep the existing `Last Party` energy
- Make the podium feel special, but not like a different product
- Use strong contrast and short verdict copy
- Avoid large blocks of explanatory text inside the cards

## Error Handling And Degradation

### Partial Demo Coverage

If some matches have demos and others do not:

- compute rivalry using FACEIT-safe metrics only
- label demo-only categories as unavailable
- avoid mixed confidence comparisons

### Small Sample Sizes

If a player has too few maps:

- suppress strong claims such as domination
- prefer softer labels like `led on average`

### Effective Ties

If two players are effectively tied:

- show the tie explicitly
- avoid assigning a fake clean winner in rivalry cards

### Empty Or Tiny Sessions

If the session has one match or too few party members:

- show the podium if meaningful
- hide unsupported rivalry cards
- keep the page valid without inventing narratives

## Testing

### Pure Function Tests

Add tests for the rivalry helper covering:

- FACEIT-only scoring
- full-demo scoring
- equal-score tiebreaks
- head-to-head comparisons
- high-variance detection
- partial-demo fallback
- tiny sample suppression

### Component Tests

Add tests to ensure:

- podium renders expected ordering
- rivalry cards render only when supported
- aggregate table shows Session Score
- evidence drawer shows breakdown reasons
- match accordion rivalry strip renders correctly

### Route-Level Tests

Verify:

- full session render with rivalry layer
- FACEIT-only session render
- partial-demo fallback behavior
- empty and one-match states remain stable

## Implementation Notes

- Start with a conservative scoring model and keep weights easy to revise
- Keep the calculation logic centralized in one helper
- Prefer adding one new concept, `Session Score`, rather than many overlapping labels
- Treat this as a read-path enhancement, not a new system of record

## Success Criteria

- A user can open `/last-party` and immediately tell who won the session
- The ranking feels competitive but defensible
- The reasons behind the podium are visible without reading raw tables alone
- The page still works cleanly with FACEIT-only data
- Demo-rich sessions feel meaningfully smarter, not just denser
