# Skeleton Loading States

Replace all text-based "Loading..." messages with pulsing skeleton UIs that match each page's loaded content layout.

## Pattern

Each skeleton is inline JSX using `animate-pulse` with `rounded bg-bg-elevated` blocks. No shared skeleton component — each page gets a fragment that mirrors its own layout. Block widths/heights approximate the real content dimensions.

Common skeleton block: `<div className="h-3 w-20 animate-pulse rounded bg-bg-elevated" />`

## Pages & Skeletons

### 1. Leaderboard — Stats Table (`leaderboard.tsx`)

**Current**: Two `"Loading..."` blocks (resolving target + loading stats).
**Skeleton**: 5 rows matching the leaderboard grid template (`3rem 1fr 4rem repeat(N, 5rem)`). Each row: rank circle + name bar + GP block + N stat blocks.

### 2. History — Match Table (`history.tsx`)

**Current**: `"Loading..."` while resolving or fetching stats.
**Skeleton**: 8 rows matching the HistoryMatchesTable grid. Each row: result badge + map block + score + stat blocks (K/D, ADR, HS%, etc.).

### 3. Last Party (`last-party.tsx`)

**Current**: `"Loading party session..."`.
**Skeleton**: Header bar with 4 stat summary blocks + 5 player rows matching SessionStatsTable grid + a map distribution placeholder bar.

### 4. Friends / Live Party (`$nickname.tsx`)

**Current**: `"Loading friends for {nickname} (up to 100)..."` and `"Loading match history..."`.

**Skeleton for friends search**: Two-column layout — left sidebar with 6 friend card skeletons (avatar circle + name bar + status dot), right area with 5 match row skeletons.

**Skeleton for match history**: 5 match rows matching the RecentMatches/MatchRow layout (win/loss bar + map + stats).

### 5. Match Detail (`match.$matchId.tsx`)

**Current**: `"Loading match..."`.
**Skeleton**: Match header (status badge + map badge) + score section (team name — score — team name) + scoreboard with 2x5 player rows (name + K/D/ADR/HS% blocks).

### 6. Bets Page (`bets.tsx`)

**Current**: `"Loading..."` for auth/season resolution.
**Skeleton**: Season header bar (name + date range + coin balance) + tab bar + 5 placeholder rows.

### 7. Season Leaderboard Tab (`SeasonLeaderboardTab.tsx`)

**Current**: `"Loading..."`.
**Skeleton**: 5 rows matching grid `3rem 1fr 5rem 5rem 5rem` (rank + player + coins + bets + win%).

### 8. Season My Bets Tab (`SeasonMyBetsTab.tsx`)

**Current**: `"Loading..."`.
**Skeleton**: 4 rows matching grid `1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr` (match + pick + amount + payout + net + status).

### 9. Season History Tab (`SeasonHistoryTab.tsx`)

**Current**: `"Loading..."`.
**Skeleton**: 3 season button skeletons + 5 leaderboard row skeletons.

### 10. Home Live Matches (`HomeLiveMatchesSection.tsx`)

**Current**: `"Loading live matches..."`.
**Skeleton**: 2 match card skeletons (team names + map + score area + betting panel outline).

## Out of Scope

- Functional animate-pulse indicators that aren't loading states (live dots, ingestion status)
- CreateSeasonForm image upload spinner
- No new shared component file — all inline

## Testing

Visual verification only. No unit tests for skeleton markup.
