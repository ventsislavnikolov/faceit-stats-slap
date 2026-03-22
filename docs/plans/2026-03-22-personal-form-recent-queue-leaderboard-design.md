# Personal Form With Recent Queue Filter Design

**Date:** 2026-03-22
**Status:** Approved

## Summary

Refine the `/leaderboard` stats tab so it shows only players the searched player has queued with recently, while ranking those eligible players by their own recent form.

This means the leaderboard answers two different questions:

- **Should this player appear?** Only if they shared at least one match with the searched player inside the selected recency window.
- **How should this player be ranked?** By that player's own last `20 / 50 / 100` matches, even if many of those matches were played without the searched player.

This replaces the current shared-match-only stats behavior, which is more restrictive than the product intent.

## Product Goals

- Keep the leaderboard relevant to the searched player's active circle
- Avoid stale names from people the searched player has not queued with for a long time
- Preserve the older "current form" feeling by using each player's own recent matches
- Make the rules explicit enough that the table is not confusing

## User Experience

The stats tab remains the default tab on `/leaderboard`.

### Filters

Keep the existing game-count pills:

- `20`
- `50`
- `100`

Update the day presets to:

- `30 days`
- `90 days`
- `180 days`
- `365 days`

The day filter controls **eligibility only**.
The game-count filter controls the **stat sample size** for each included player.

### Summary Copy

The summary line should explicitly explain the split behavior. Example:

`Showing players you queued with in the last 90 days. Stats are from each player's own last 20 matches.`

This is important because the table is no longer "shared-match stats," and it should not look like all rows are based on the searched player's own matches either.

### Table Semantics

- A player appears if they shared at least one match with the searched player in the selected `30 / 90 / 180 / 365` day window
- A visible player's row stats come from that player's own last `20 / 50 / 100` matches
- `GP` means the number of that player's own matches used for the row
- Sorting and stat groups remain unchanged
- The current user's row can still be highlighted when present

## Query And Data Flow

The backend should use a two-stage query.

### Stage 1: Build the eligible friend set

Inspect the searched player's matches inside the selected day window and collect friend ids that appeared with them at least once.

This stage answers:

- who qualifies for the leaderboard
- whether the searched player had any recent matches at all
- whether any tracked friends qualified in that window

### Stage 2: Rank eligible players by personal recent form

For only the eligible friend ids from stage 1, aggregate each player's own last `20 / 50 / 100` matches from `match_player_stats`.

This stage should reuse the older leaderboard logic:

- pull each player's personal recent rows
- compute aggregates like `avgKd`, `avgAdr`, `winRate`, and so on
- sort by the selected column, default `avgKd desc`

The critical rule is:

- shared matches determine visibility
- personal recent matches determine score

## Refresh Behavior

The refresh path should match that split.

It needs enough searched-player history to determine which friends qualify inside the selected `30 / 90 / 180 / 365` window. After the eligible set is known, it should also have enough synced history for each eligible friend so their own last `20 / 50 / 100` matches can be aggregated accurately.

This is different from the current shared-match implementation, which syncs toward shared rows only.

## Empty States

Use separate empty states:

- If the searched player has no matches in the selected window:
  `No recent matches for this player in the last 90 days.`
- If the searched player has matches in the selected window but none with tracked friends:
  `No recently queued friends in the last 90 days.`

If a friend qualifies but has fewer than `20 / 50 / 100` synced personal matches, still show them with the smaller `GP`.

## Testing

Add coverage for:

- a friend qualifies after sharing exactly one match within the selected day window
- a qualified friend's own non-shared recent matches affect their row stats
- a friend with strong personal stats but no shared match in the selected window is excluded
- changing `30 / 90 / 180 / 365` changes eligibility only
- changing `20 / 50 / 100` changes each included player's own stat sample only
- summary copy clearly reflects the split behavior
- both empty states render correctly

## Files Expected To Change During Implementation

- `src/routes/_authed/leaderboard.tsx`
- `src/hooks/useStatsLeaderboard.ts`
- `src/hooks/useSyncPlayerHistory.ts`
- `src/server/matches.ts`
- `src/lib/stats-leaderboard-copy.ts`
- tests covering leaderboard query behavior and copy

## Out Of Scope

- Manual ignore list
- Custom freeform day input
- Additional queue-threshold rules beyond "at least one shared match"
- URL persistence for filters
