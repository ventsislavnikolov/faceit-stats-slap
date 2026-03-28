# Bets Page Design

## Problem

Bets tabs are embedded inside History and Leaderboard pages, but they don't use the player search those pages provide. This creates a confusing UX — the search bar sits unused on the Bets tab.

## Solution

Move Bets to its own dedicated `/bets` route with two sub-tabs.

## Route & Auth

- **Route**: `/bets` under `/_authed`
- **Auth**: requires sign-in; redirect to `/sign-in` if unauthenticated
- **Search params**: `?tab=my-bets|leaderboard` (default: `my-bets`)
- No `PlayerSearchHeader` — Bets doesn't need player search

## Page Structure

- `PageSectionTabs` at top with two tabs: "My Bets" and "Leaderboard"
- "My Bets" tab renders existing `BetHistoryTab` component (props: `userId`)
- "Leaderboard" tab renders existing `BetsLeaderboardTab` component (props: `userId`)
- Scrollable content area matching History/Leaderboard layout (`max-w-6xl` centered)

## Nav Changes

- Add "Bets" link in nav between Leaderboard and History
- Present in both desktop inline nav and mobile hamburger menu
- Only visible when user is signed in

## Cleanup from Existing Pages

### History (`/history`)
- Remove "Bets" tab from `PageSectionTabs`
- Remove `BetHistoryTab` import and rendering
- Remove `getHistoryTabs()` usage — page always shows matches
- Remove auth-gating logic for bets tab redirect
- Remove `tab` search param validation for "bets"
- Remove `BetHistoryTab` import

### Leaderboard (`/leaderboard`)
- Remove "Bets" tab from `PageSectionTabs`
- Remove `BetsLeaderboardTab` import and rendering
- Remove `getLeaderboardTabs()` / `normalizeLeaderboardTab()` / `shouldRenderLeaderboardBetsTab()` usage
- Remove auth-gating logic for bets tab redirect
- Remove `tab` search param validation for "bets"
- Remove `BetsLeaderboardTab` import

## Files to Create

- `src/routes/_authed/bets.tsx` — new page component

## Files to Modify

- `src/routes/_authed.tsx` — add Bets nav link (after Leaderboard, before History), only when signed in
- `src/routes/_authed/history.tsx` — remove Bets tab and related logic
- `src/routes/_authed/leaderboard.tsx` — remove Bets tab and related logic
- `src/lib/player-view-shell.ts` — add "bets" to `PlayerView` type if needed for nav

## Files to Potentially Remove/Simplify

- `src/lib/history-page.ts` — `getHistoryTabs()` becomes unnecessary
- `src/lib/leaderboard-page.ts` — `getLeaderboardTabs()`, `normalizeLeaderboardTab()`, `shouldRenderLeaderboardBetsTab()` become unnecessary
