# Shared Match Leaderboard Design

**Date:** 2026-03-22
**Status:** Approved

## Summary

Refine the `/leaderboard` stats tab so it ranks a searched player's recent squad instead of their broader FACEIT friend graph. A friend should only appear if they played at least one shared match with the searched player inside a selected recency window, and each friend's stats should be calculated only from those shared matches.

This replaces the misleading behavior where inactive friends, or friends playing with other stacks, can still appear and rank above relevant teammates.

## Product Goals

- Keep the leaderboard aligned with the searched player's recent stack
- Exclude stale friends without introducing manual curation
- Preserve the existing fast leaderboard workflow and sorting UI
- Keep the feature honest by showing only shared-match performance

## User Experience

The stats tab remains the default tab on `/leaderboard`. The searched player still drives the page, but the leaderboard semantics change from "friends of this player" to "recent squad leaderboard for this player."

### Filters

Keep the existing game-count pills:

- `20`
- `50`
- `100`

Add a second filter row for recent activity:

- `7 days`
- `30 days` (default)
- `90 days`

The day filter controls match eligibility. The game-count filter caps how many shared matches per friend can be used for aggregation after the date window is applied.

### Table Semantics

- Only show friends who shared at least one finished match with the searched player inside the selected day window
- Compute every stat from those shared matches only
- `GP` means shared games used, not a friend's personal recent games
- Keep the existing sort controls and stat groups
- Keep the current row highlight for the app owner's FACEIT account when present

## Data Model

No ignore-list table is needed for this version. The feature should reuse the existing `matches` and `match_player_stats` tables.

The backend already stores per-player stats by match. The new requirement is query shape, not schema shape. We need to identify the searched player's recent finished matches, then intersect those matches with the searched player's friend ids.

## Query Design

The leaderboard query should accept:

- `targetPlayerId`
- `friendIds`
- `n`
- `days`

Recommended flow:

1. Find finished matches for `targetPlayerId` where `played_at >= now() - interval(days)`
2. Order those matches by `played_at desc`
3. For each friend, find shared matches from that set where both players have rows in `match_player_stats`
4. Limit each friend's aggregation to the latest `n` shared matches
5. Aggregate leaderboard metrics from only those rows
6. Drop friends with zero shared matches in scope
7. Sort by the active stat, defaulting to `avgKd desc`

This makes both eligibility and ranking come from the same shared-match source of truth.

## Sync Flow

The existing refresh behavior can remain with a small contract change. Refresh should sync the searched player and the searched player's friend list so shared-match queries have current data.

The mutation does not need to calculate the leaderboard itself. It only needs to refresh match and player-stat rows. The leaderboard query stays DB-backed and fast.

## UI Copy

Update the summary line to reflect the new meaning. Instead of only showing friend count, prefer copy like:

- `Recent squad leaderboard for <nickname>`
- `<count> friends played together in the last <days> days`

## Empty States

Use specific empty states:

- If the searched player has no finished matches in the selected window:
  `No matches found for this player in the last 30 days.`
- If the searched player has matches but no friends shared any of them:
  `No friends played with this player in the last 30 days.`

Do not render zero-stat placeholder rows for excluded friends.

## Error Handling

- Keep per-request tolerance for FACEIT fetch failures during refresh
- Use whatever synced data is available instead of failing the entire table
- If refresh fails entirely, preserve the last successful leaderboard data and surface the button error state separately

## Testing

Add coverage for:

- Friend played recently but never with the searched player -> excluded
- Friend shared one or more matches within the day window -> included
- Stats aggregate only shared matches, ignoring unrelated matches
- Changing `7 / 30 / 90 days` changes both eligibility and aggregates
- Changing `20 / 50 / 100` caps shared matches only
- Correct empty state when player has no recent matches
- Correct empty state when player has recent matches but no shared-friend matches

## Files Expected To Change During Implementation

- `src/routes/_authed/leaderboard.tsx`
- `src/hooks/useStatsLeaderboard.ts`
- `src/hooks/useSyncPlayerHistory.ts`
- `src/server/matches.ts`
- Tests covering shared-match leaderboard behavior

## Out Of Scope

- Manual ignore list
- Custom freeform day input
- Persisting filter state to the URL or local storage
- Mixing shared-match stats with each friend's broader personal stats
- Background sync jobs
