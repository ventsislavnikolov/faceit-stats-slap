# Live Betting Home And Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live betting feed to Home, restore betting tabs on Leaderboard and History, and rank betting results by net profit without disturbing the existing FACEIT stats flows.

**Architecture:** Reuse the existing live match and betting pipelines instead of introducing new endpoints. Keep `Stats` and `Matches` behavior intact, add betting-only helpers for tab normalization and aggregate math, and use the tracked FACEIT webhook player set as the initial Home live-feed source.

**Tech Stack:** TanStack Start, TanStack Router, TanStack Query, React 19, Vitest, Supabase server functions

---

### Task 1: Restore Tab State Helpers And Route Wiring

**Files:**
- Create: `src/lib/leaderboard-page.ts`
- Modify: `src/routes/_authed/leaderboard.tsx`
- Modify: `src/routes/_authed/history.tsx`
- Test: `tests/lib/leaderboard-page.test.ts`
- Test: `tests/lib/history-page.test.ts`

**Step 1: Write the failing tab-helper tests**

Create `tests/lib/leaderboard-page.test.ts` with coverage for:

```ts
import { describe, expect, it } from "vitest";
import {
  getLeaderboardTabs,
  normalizeLeaderboardTab,
  type LeaderboardTab,
} from "~/lib/leaderboard-page";

describe("leaderboard page tabs", () => {
  it("shows stats and bets tabs for signed-in users", () => {
    expect(getLeaderboardTabs(true)).toEqual(["stats", "bets"]);
  });

  it("falls back to stats when bets is unavailable", () => {
    expect(normalizeLeaderboardTab("bets", false)).toBe("stats");
    expect(normalizeLeaderboardTab("stats", false)).toBe("stats");
  });
});
```

Extend `tests/lib/history-page.test.ts` so it asserts the existing helpers still normalize `bets` safely for signed-out users.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/lib/leaderboard-page.test.ts tests/lib/history-page.test.ts
```

Expected: FAIL because `src/lib/leaderboard-page.ts` does not exist and the route logic does not yet use a `tab` search param.

**Step 3: Implement the minimal helpers**

Create `src/lib/leaderboard-page.ts`:

```ts
export type LeaderboardTab = "stats" | "bets";

export function getLeaderboardTabs(isSignedIn: boolean): LeaderboardTab[] {
  return isSignedIn ? ["stats", "bets"] : ["stats"];
}

export function normalizeLeaderboardTab(
  value: unknown,
  isSignedIn: boolean,
): LeaderboardTab {
  const tab = value === "bets" ? "bets" : "stats";
  return !isSignedIn && tab === "bets" ? "stats" : tab;
}
```

Update `src/routes/_authed/leaderboard.tsx` to:

- validate `search.tab`
- default to `stats`
- render `PageSectionTabs`
- switch between the existing stats content and a placeholder bets container

Update `src/routes/_authed/history.tsx` to:

- validate `search.tab`
- keep match filters scoped to `tab === "matches"`
- render `PageSectionTabs`
- reserve a placeholder branch for the bets tab

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/lib/leaderboard-page.test.ts tests/lib/history-page.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/leaderboard-page.ts src/routes/_authed/leaderboard.tsx src/routes/_authed/history.tsx tests/lib/leaderboard-page.test.ts tests/lib/history-page.test.ts
git commit -m "💫 ui(nav): restore betting tabs on leaderboard and history"
```

### Task 2: Add Betting Aggregate Types And Pure Helper Math

**Files:**
- Create: `src/lib/betting-stats.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/lib/betting-stats.test.ts`

**Step 1: Write the failing aggregate tests**

Create `tests/lib/betting-stats.test.ts` covering:

- win rows count toward `betsWon`
- refund rows do not count as wins
- pending rows do not count as resolved
- net profit equals `sum(payout ?? 0) - sum(amount)` for resolved rows
- win rate is `betsWon / resolvedBets`
- leaderboard rows sort by `netProfit` then `coins`

Use fixtures shaped like:

```ts
const bets = [
  { amount: 100, payout: 180, pool: { status: "RESOLVED" } },
  { amount: 50, payout: 50, pool: { status: "REFUNDED" } },
  { amount: 75, payout: null, pool: { status: "OPEN" } },
];
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/lib/betting-stats.test.ts
```

Expected: FAIL because the helper module and new types do not exist.

**Step 3: Implement the minimal helper layer**

Add betting-oriented types in `src/lib/types.ts`:

```ts
export interface BettingLeaderboardEntry {
  userId: string;
  nickname: string;
  coins: number;
  betsPlaced: number;
  betsWon: number;
  resolvedBets: number;
  totalWagered: number;
  totalReturned: number;
  netProfit: number;
  winRate: number;
}

export interface BetHistorySummary {
  coins: number;
  betsPlaced: number;
  betsWon: number;
  resolvedBets: number;
  refundedBets: number;
  pendingBets: number;
  totalWagered: number;
  totalReturned: number;
  netProfit: number;
  winRate: number;
}
```

Create `src/lib/betting-stats.ts` with small pure helpers:

- `buildBetHistorySummary`
- `sortBettingLeaderboardEntries`
- `getBetOutcomeLabel`

Keep this module UI-agnostic so both server queries and components can reuse it.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/lib/betting-stats.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/betting-stats.ts src/lib/types.ts tests/lib/betting-stats.test.ts
git commit -m "✨ feat(betting): add betting aggregate helpers"
```

### Task 3: Expand Betting Server Data For Profit-First Views

**Files:**
- Modify: `src/server/betting.ts`
- Modify: `src/hooks/useLeaderboard.ts`
- Modify: `src/hooks/useUserBets.ts`
- Test: `tests/server/betting.test.ts`

**Step 1: Write the failing server tests**

Create `tests/server/betting.test.ts` to cover:

- `getLeaderboard()` returns rows with `netProfit`, `totalWagered`, `totalReturned`, `resolvedBets`, and `winRate`
- rows are sorted by `netProfit` descending and then `coins` descending
- refunded bets count toward returned value but not wins
- pending bets count toward placed bets but not resolved bets

Mock Supabase profile rows and bet rows directly, following the existing server-test style used elsewhere in the repo.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/betting.test.ts
```

Expected: FAIL because `getLeaderboard()` still returns only coins, placed count, and won count.

**Step 3: Implement the server query changes**

Update `src/server/betting.ts` so:

- `getLeaderboard()` returns `BettingLeaderboardEntry[]`
- it reads all profiles ordered by coins
- it reads all bets with joined pool status if needed
- it uses the pure helpers from `src/lib/betting-stats.ts`
- it derives profit and resolved metrics without changing the database schema

Update `src/hooks/useLeaderboard.ts` to return the new entry shape.

Keep `useUserBets` stable unless small typing cleanup is needed.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/betting.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/betting.ts src/hooks/useLeaderboard.ts src/hooks/useUserBets.ts tests/server/betting.test.ts
git commit -m "✨ feat(betting): rank leaderboard by net profit"
```

### Task 4: Implement Leaderboard Bets And History Bets UI

**Files:**
- Create: `src/components/BetsLeaderboardTab.tsx`
- Create: `src/components/BetHistoryTab.tsx`
- Modify: `src/routes/_authed/leaderboard.tsx`
- Modify: `src/routes/_authed/history.tsx`
- Test: `tests/components/bets-leaderboard-tab.test.tsx`
- Test: `tests/components/bet-history-tab.test.tsx`

**Step 1: Write the failing component tests**

Add coverage for:

- leaderboard renders a `Bets` tab and shows `P/L` before other betting columns
- current user row is highlighted when present
- history `Bets` tab renders summary cards first
- empty bet history shows a clear empty state
- pending, refunded, won, and lost rows render distinct status labels

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/components/bets-leaderboard-tab.test.tsx tests/components/bet-history-tab.test.tsx
```

Expected: FAIL because the components do not exist and routes do not render them yet.

**Step 3: Implement the components**

`src/components/BetsLeaderboardTab.tsx`:

- call `useLeaderboard()`
- sort via `sortBettingLeaderboardEntries`
- default visible ordering:
  - rank
  - nickname
  - P/L
  - coins
  - placed
  - won
  - win rate
- highlight negative profit in error color and positive profit in accent

`src/components/BetHistoryTab.tsx`:

- accept `userId`
- call `useUserBets(userId)` and `useCoinBalance(userId)`
- compute summary with `buildBetHistorySummary`
- render summary cards above the ledger
- render rows with:
  - map or team names
  - selected side
  - amount
  - payout
  - net result
  - outcome label

Wire these into the restored tab branches in:

- `src/routes/_authed/leaderboard.tsx`
- `src/routes/_authed/history.tsx`

Use the existing auth session state pattern already present in the app layout and player route. Do not move or rewrite the current stats and match-history implementations.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/components/bets-leaderboard-tab.test.tsx tests/components/bet-history-tab.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/BetsLeaderboardTab.tsx src/components/BetHistoryTab.tsx src/routes/_authed/leaderboard.tsx src/routes/_authed/history.tsx tests/components/bets-leaderboard-tab.test.tsx tests/components/bet-history-tab.test.tsx
git commit -m "💫 ui(betting): restore leaderboard and history bet views"
```

### Task 5: Add Home Live Feed With Existing Match Cards

**Files:**
- Create: `src/components/HomeLiveMatchesSection.tsx`
- Modify: `src/routes/_authed/index.tsx`
- Modify: `src/lib/faceit-webhooks.ts`
- Test: `tests/components/home-live-matches-section.test.tsx`

**Step 1: Write the failing home-feed tests**

Cover:

- loading state
- empty state
- populated state with at least one `LiveMatchCard`
- search form still renders above the live section

Mock `useLiveMatches`, `useCoinBalance`, and session state as needed.

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/components/home-live-matches-section.test.tsx
```

Expected: FAIL because the section component does not exist and Home still renders only search.

**Step 3: Implement the minimal home feed**

Export a small helper from `src/lib/faceit-webhooks.ts`:

```ts
export function getTrackedWebhookPlayerIds(): string[] {
  return Object.values(TRACKED_WEBHOOK_PLAYERS).map((player) => player.faceitId);
}
```

Create `src/components/HomeLiveMatchesSection.tsx`:

- use `getTrackedWebhookPlayerIds()`
- call `useLiveMatches`
- read user coin/session state only if needed for `LiveMatchCard`
- render:
  - loading text
  - empty text
  - list of existing `LiveMatchCard`s

Update `src/routes/_authed/index.tsx` so the layout becomes:

1. search copy
2. search form
3. live matches section

Keep the page centered only where it still makes sense; do not preserve a full-screen empty-center layout once the feed exists.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/components/home-live-matches-section.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/HomeLiveMatchesSection.tsx src/routes/_authed/index.tsx src/lib/faceit-webhooks.ts tests/components/home-live-matches-section.test.tsx
git commit -m "✨ feat(home): show live betting feed on home"
```

### Task 6: Full Regression Verification

**Files:**
- Modify: `docs/plans/2026-03-24-live-betting-home-and-tabs.md` if command notes need adjustment

**Step 1: Run the focused test slices**

Run:

```bash
pnpm test tests/lib/leaderboard-page.test.ts tests/lib/history-page.test.ts tests/lib/betting-stats.test.ts tests/server/betting.test.ts tests/components/bets-leaderboard-tab.test.tsx tests/components/bet-history-tab.test.tsx tests/components/home-live-matches-section.test.tsx
```

Expected: PASS.

**Step 2: Run the full suite**

Run:

```bash
pnpm test
```

Expected: PASS with no regressions from the restored tabs or Home feed changes.

**Step 3: Smoke-check the app locally**

Run:

```bash
pnpm dev
```

Manual checks:

- `/` shows search first and live cards below
- `/leaderboard` defaults to `Stats`
- `/leaderboard?tab=bets` shows profit-first betting ranking
- `/history` defaults to `Matches`
- `/history?tab=bets` shows summary cards above the ledger
- signed-out behavior does not expose broken betting states

**Step 4: Commit final polish**

```bash
git add .
git commit -m "✅ test(betting): cover live home and tab regressions"
```
