# Tracked Player Alias Design

## Goal

Add a reserved `tracked` player alias that lets the app open existing single-player views for the tracked stack without making the user guess which current stack member has data. The alias should resolve to one active tracked player from `tracked_friends`, using page-specific rules, and then keep that resolved player stable while the user navigates tabs.

## Problem

The current player-oriented pages assume the user knows which stack member to search for:

- `/tracked` does not exist
- `/history`, `/leaderboard`, and `/last-party` require a nickname or FACEIT id
- when the active five changes between games, the user must manually retry different nicknames until one has the right data

This is especially painful for:

- live stack churn during the same session
- party views that depend on who actually played a given game or date
- cases where yesterday had no games for one tracked player but did for another

## Product Decisions

- `tracked` is a reserved private keyword
- `tracked` never resolves to a real FACEIT nickname named `tracked`
- `tracked` resolves to one active tracked player, not an aggregate multi-player mode
- when multiple tracked players qualify, choose the player with the most recent matching data for that page
- if no active tracked player qualifies, show a tracked-specific empty state
- support `tracked` everywhere a player can be entered, including `/tracked`
- `/tracked` opens the existing Friends view by default
- the UI does not explicitly announce which tracked player was chosen
- once `tracked` resolves for the current browsing flow, keep that resolved player locked across tab navigation rather than re-resolving independently on every page
- for `/tracked` Friends view, prefer a currently live tracked player; otherwise use the tracked player with the most recent match

## Scope

This design covers:

- `/tracked`
- `/history?player=tracked`
- `/leaderboard?player=tracked`
- `/last-party?player=tracked`
- any shared tab-navigation utilities that move between these views
- player search submission behavior where users type `tracked`

This design does not introduce:

- an aggregate tracked-stack analytics mode
- a new schema for synthetic tracked sessions
- UI banners explaining which player was selected

## Existing Structure

Current routes and flow:

- [src/routes/_authed/$nickname.tsx](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/$nickname.tsx) drives the Friends/player page by explicit nickname route param
- [src/routes/_authed/history.tsx](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/history.tsx) resolves `search.player` with `resolvePlayer`
- [src/routes/_authed/leaderboard.tsx](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/leaderboard.tsx) resolves `search.player` with `searchAndLoadFriends`
- [src/routes/_authed/last-party.tsx](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/last-party.tsx) resolves `search.player` with `resolvePlayer`
- [src/lib/player-view-shell.ts](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/lib/player-view-shell.ts) builds cross-tab links assuming a concrete nickname

Tracked players now live in `tracked_friends` and active tracked player loading already exists in the server path through [src/server/tracked-players.server.ts](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/server/tracked-players.server.ts).

## Recommended Approach

Introduce a small server-side tracked alias resolver that selects one active tracked player for a specific page context, then reuse the existing single-player pages unchanged after resolution.

This keeps the current UX model:

- each page still renders one player
- existing hooks and server functions remain mostly intact
- tracked logic is centralized instead of spread across routes

## Alternatives Considered

### 1. Resolve `tracked` independently on every page

Pros:

- least coordination between routes
- simpler search param shape

Cons:

- tab navigation becomes unstable
- `/history?player=tracked` could show one player while `/leaderboard?player=tracked` silently jumps to another
- feels random during navigation

Rejected because the user explicitly wants a stable experience once the alias has chosen a player.

### 2. Build a true tracked-stack aggregate mode

Pros:

- more powerful long term
- avoids choosing a single representative player

Cons:

- fundamentally different product behavior
- requires rewriting leaderboard/history/party semantics
- much larger scope than needed

Rejected because the user explicitly wants the existing single-player pages to “search for everyone until find data” and then show one player.

## Architecture

### 1. Reserved alias recognition

Add a shared helper that answers:

- is the raw player input equal to `tracked` after trim/lowercase normalization?

This helper should be used by:

- search submission handlers
- route loaders
- tab-link generation logic

### 2. Tracked alias resolver

Create a focused server module, for example `src/server/tracked-alias.ts`, responsible for:

- loading active tracked players from `tracked_friends`
- applying page-specific resolution rules
- returning either:
  - `{ faceitId, nickname }`
  - or `null` when no active tracked player qualifies

The resolver should not render UI and should not know route components. It should only answer “which tracked player should represent this page context?”

### 3. Page-specific resolution strategies

#### Friends `/tracked`

Resolution rule:

1. choose any currently live tracked player
2. if multiple are live, choose the one with the most recent current activity signal available from existing live/history sources
3. if none are live, choose the tracked player with the most recent match
4. if no tracked player has recent activity, return `null`

#### History

Input:

- `matches`
- `queue`

Resolution rule:

- choose the tracked player with the most recent history row matching the requested filters

If none qualify, return `null`.

#### Leaderboard

Input:

- `matches`
- `queue`
- `last`

Resolution rule:

- choose the tracked player whose qualifying leaderboard basis has the freshest matching data for the requested filters

Operationally, this should reuse the same underlying history/stats inputs that already feed the leaderboard rather than inventing a separate notion of freshness.

If none qualify, return `null`.

#### Last Party

Input:

- `date`

Resolution rule:

- choose the tracked player with the most recent party session on the selected date

If none qualify, return `null`.

### 4. Locked resolved player

Once `tracked` resolves for a browsing flow, keep that player stable across tab navigation.

Recommended URL model:

- preserve user intent with `player=tracked`
- add an internal resolved value in search params or route-building state

Examples:

- `/history?player=tracked&resolvedPlayerId=<faceit-id>&matches=20&queue=party`
- `/leaderboard?player=tracked&resolvedPlayerId=<faceit-id>&matches=20&queue=party&last=30`
- `/last-party?player=tracked&resolvedPlayerId=<faceit-id>&date=2026-04-07`

For `/tracked`, the route itself can resolve once and then tab links should carry the locked resolved player forward.

This gives:

- stable navigation
- shareable URLs
- refresh-safe behavior
- preserved user intent that the session began from the alias, not from manually choosing a nickname

### 5. Silent rendering

After resolution, pages render exactly like the resolved player’s existing page. Do not add:

- “Showing tracked via X”
- badge text
- explanation banners

Only tracked-specific empty states should differ.

## Route Behavior

### `/tracked`

- resolve using Friends view rule
- if resolved, render the existing Friends/player view for that player
- if not resolved, show `No tracked player has recent activity yet.`

### `/history?player=tracked&matches=20&queue=party`

- if `resolvedPlayerId` is present and still valid for the session, use it
- otherwise resolve using History rule
- if resolved, render current history page for that player
- if not resolved, show `No tracked player has matching history for these filters.`

### `/leaderboard?player=tracked&matches=20&queue=party&last=30`

- if `resolvedPlayerId` is present and still valid for the session, use it
- otherwise resolve using Leaderboard rule
- if resolved, render current leaderboard page for that player
- if not resolved, show `No tracked player has leaderboard data for these filters.`

### `/last-party?player=tracked&date=YYYY-MM-DD`

- if `resolvedPlayerId` is present and still valid for the session, use it
- otherwise resolve using Last Party rule
- if resolved, render current last-party page for that player
- if not resolved, show `No tracked player had a party session on this date.`

## Search Behavior

When users type `tracked` into player search inputs:

- do not call FACEIT player resolution for literal nickname `tracked`
- navigate directly into alias-aware routes
- preserve existing behavior for FACEIT nicknames, UUIDs, links, and match ids

Examples:

- Friends search input `tracked` navigates to `/tracked`
- History search input `tracked` navigates to `/history?player=tracked&matches=<current>&queue=<current>`
- Leaderboard search input `tracked` navigates to `/leaderboard?player=tracked&matches=<current>&queue=<current>&last=<current>`
- Last Party search input `tracked` navigates to `/last-party?player=tracked&date=<current>`

## Data Flow

### Normal player flow

1. User enters normal nickname/UUID
2. Existing route resolves concrete player
3. Existing page logic runs unchanged

### Tracked alias flow

1. User enters `tracked`
2. Route/search logic detects reserved alias
3. Page-specific tracked resolver chooses one active tracked player or returns `null`
4. If resolved, page loads existing single-player data for that player
5. Tab links carry the locked resolved player to avoid re-selection
6. If unresolved, route shows tracked-specific empty state

## Error Handling

- If `tracked_friends` has zero active rows, all tracked routes should render tracked-specific empty states instead of generic player-not-found errors
- If a previously locked `resolvedPlayerId` is no longer active, re-run resolution for that page context
- If resolution fails because underlying data queries fail, show existing route-level loading/error behavior rather than pretending no tracked player exists
- Do not let `tracked` fall through to FACEIT nickname resolution

## Testing Strategy

### Unit tests

- alias detection helper recognizes `tracked` case-insensitively and rejects normal nicknames
- tracked resolver returns `null` when no active tracked players exist
- Friends resolver prefers live tracked player over recent-match fallback
- History resolver picks the tracked player with the freshest qualifying history row
- Leaderboard resolver picks the tracked player with the freshest qualifying leaderboard basis
- Last Party resolver picks the tracked player with a qualifying session on the requested date
- locked resolved player is reused across tab-link generation
- stale or inactive locked player triggers re-resolution

### Route/component tests

- `/tracked` renders the same player shell as the resolved player route
- History route with `player=tracked` shows tracked-specific empty state when no tracked player qualifies
- Leaderboard route with `player=tracked` preserves current `matches`, `queue`, and `last` filters
- Last Party route with `player=tracked` preserves selected date
- search header submission with `tracked` navigates to alias routes instead of calling FACEIT resolution

### Regression tests

- normal nickname searches still work unchanged
- direct match id search still routes to `/match/$matchId`
- normal tab links for explicit players still behave as before

## Implementation Notes

- keep the tracked resolver server-side
- avoid duplicating page business logic inside the resolver
- prefer thin page adapters that ask the resolver for a concrete player and then hand off to existing hooks/server functions
- keep URL semantics explicit enough that a refreshed page stays stable

## Risks

- locking behavior can become inconsistent if some tab links forget to carry the resolved player
- “freshest matching data” must be defined by existing page data sources, not by an unrelated timestamp, or users will see surprising picks
- if the silent resolution picks a player with sparse data, users may not understand why content changed unless empty states are precise

## Recommendation

Implement the reserved `tracked` alias as a page-aware server-side resolver that chooses one active tracked player and locks that choice across tabs. This gives the desired UX with minimal disruption to the existing single-player pages and keeps the special logic centralized.
