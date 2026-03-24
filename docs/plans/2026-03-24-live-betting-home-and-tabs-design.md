# Live Betting Home And Tabs Design

## Overview

Restore betting as a first-class experience without removing the existing FACEIT player flows.

Validated product decisions:

- Home keeps the existing search entry point.
- Home adds a live matches feed below search so active betting is visible immediately.
- Leaderboard restores tabs and keeps both views:
  - `Stats` for the current player-performance leaderboard
  - `Bets` for betting rankings
- History restores tabs and keeps both views:
  - `Matches` for FACEIT match history
  - `Bets` for personal betting history
- Betting leaderboard ranks by net profit/loss first.
- Betting history defaults to summary cards first, then a detailed bet ledger.

This is an integration pass. The app already has live match cards, betting pools, bet history queries, and traces of hidden tab helpers. The goal is to reconnect those pieces into the intended product shape instead of introducing a parallel betting UI.

## Architecture

### Home

`/_authed/` stays lightweight but stops being search-only.

Structure:

1. Existing FACEIT search header and search form stay at the top.
2. A new live section renders below the search form.
3. That section fetches tracked live matches and renders the existing `LiveMatchCard` component for each active match.

The home page becomes the default "what is live right now?" surface while preserving fast navigation to player and match dashboards.

### Leaderboard

`/_authed/leaderboard` restores top-level page tabs:

- `Stats`
- `Bets`

`Stats` keeps the current implementation unchanged.

`Bets` becomes a dedicated betting leaderboard powered by betting aggregates. This avoids replacing the existing stats work and matches prior product intent captured in git history and older specs.

### History

`/_authed/history` restores top-level page tabs:

- `Matches`
- `Bets`

`Matches` keeps the current implementation unchanged.

`Bets` becomes a signed-in personal betting page with summary cards first and a detailed ledger below.

## Components

### Home Live Feed

Add a small home-specific section component, for example `HomeLiveMatchesSection`.

Responsibilities:

- request live matches for the tracked friend group
- show loading, empty, and populated states
- render existing `LiveMatchCard` rows

`LiveMatchCard` remains the source of truth for:

- match status
- score
- live or final scoreboard
- betting panel
- post-match state

This keeps betting presentation consistent between Home and any deeper match-oriented view.

### Leaderboard Bets Tab

Add a `BetsLeaderboardTab` component and wire it through `PageSectionTabs`.

Recommended columns:

- rank
- nickname
- net profit/loss
- current coins
- bets placed
- bets won
- win rate

Default sort is net profit descending. Profit should be visually distinct so losing users are easy to scan.

### History Bets Tab

Add a `BetHistoryTab` component.

Top summary cards:

- net profit/loss
- total wagered
- total returned
- bets placed
- win rate
- current coin balance

Ledger table columns:

- date or recency
- map or match reference
- pick
- amount
- payout
- net result
- status

## Data Flow

### Home Live Matches

Reuse the existing live match pipeline:

- `useLiveMatches`
- `getLiveMatches`
- `LiveMatchCard`
- `useBettingPool`
- `BettingPanel`

The new work is mainly deciding which player IDs Home should track. That should come from the same friend-loading path already used elsewhere rather than introducing a new backend concept.

### Betting Leaderboard

The existing `getLeaderboard()` server function is too shallow for profit-first ranking. Extend it to return aggregate betting metrics derived from existing `bets` and `betting_pools` data.

Required derived fields:

- current coins
- bets placed
- bets won
- resolved bets
- total wagered
- total returned
- net profit/loss
- win rate

Suggested sort:

1. net profit descending
2. current coins descending
3. bets won descending

This remains a read-only query over existing betting tables.

### Bet History

Reuse `getUserBetHistory(userId)` as the base data source.

That result already includes:

- individual bet row
- amount
- payout
- selected side
- joined betting pool

From that payload derive:

- wins
- losses
- refunds
- pending bets
- total wagered
- total returned
- net profit/loss

No schema change is required for this view.

## Routing And State

### Leaderboard

Add a tab search param, for example `tab=stats|bets`, and normalize it similarly to the history route. Default stays `stats`.

Behavior:

- signed-in users can access both tabs
- signed-out users can still view the page, but the `Bets` tab should either be hidden or show a sign-in requirement depending on the current auth pattern in the route

### History

Reuse the already existing helper model in `src/lib/history-page.ts`:

- `matches`
- `bets`

Current match-specific filters stay scoped to the `Matches` tab. The `Bets` tab should not carry FACEIT match-count or queue controls because they do not apply to betting history.

## Error Handling

Home:

- if live match loading fails, show a compact inline error
- if no tracked players are live, show a clear empty state instead of a blank area

Leaderboard bets:

- show an inline error without affecting the `Stats` tab
- show an empty state when no resolved bets exist yet

History bets:

- show an empty state when the user has not placed any bets
- keep pending bets visible even when payout is still null
- label refunded outcomes explicitly instead of treating them as wins

## Testing

Add coverage in three layers.

### Helper Tests

- leaderboard aggregate calculations for:
  - win
  - loss
  - refund
  - pending bet
- profit/loss math
- leaderboard ranking order
- tab normalization for the restored leaderboard tab param

### Component Tests

- home renders live section empty and populated states
- leaderboard renders `Stats` and `Bets` tabs
- history renders `Matches` and `Bets` tabs for signed-in users
- bet history summary cards and ledger empty states

### Server Tests

- `getLeaderboard()` returns profit-first aggregates correctly
- `getUserBetHistory()` derived summary handles refunds and unresolved bets correctly

## Implementation Notes

- Prefer reuse over new UI primitives.
- Do not replace the current stats leaderboard implementation.
- Do not replace the current match history implementation.
- Keep betting-specific filters and aggregate logic isolated to betting tabs.
- Keep the Home live feed visually subordinate to search, but large enough that betting opportunities are obvious on page load.
