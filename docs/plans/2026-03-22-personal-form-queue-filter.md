# Personal Form Queue Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show only players the searched player queued with recently, while ranking each visible player by their own last `20 / 50 / 100` matches.

**Architecture:** Replace the current shared-match aggregation model with a two-stage leaderboard flow. Stage 1 builds the eligible friend set from the searched player's recent shared matches inside the selected `30 / 90 / 180 / 365` day window. Stage 2 aggregates each eligible friend's personal recent form from their own last `N` matches, then the UI explains that split explicitly.

**Tech Stack:** TanStack Start, React 19, TanStack Query, Supabase server client, Vitest, TypeScript

---

### Task 1: Replace shared-match helper logic with eligibility-first aggregation

**Files:**
- Modify: `src/lib/stats-leaderboard.ts`
- Modify: `tests/lib/stats-leaderboard.test.ts`
- Reference: `src/lib/types.ts:152-174`

**Step 1: Write the failing test**

Extend `tests/lib/stats-leaderboard.test.ts` so it covers the new split behavior:
- a friend qualifies because they shared one recent match with the target
- that same friend's row stats include newer personal matches that were not shared with the target
- a friend with strong personal stats but no shared match in the day window is excluded
- `gamesPlayed` returns the number of personal matches used for the row, not shared matches

Add a focused case like:

```ts
it("uses personal recent matches after a friend qualifies via one shared match", () => {
  const result = buildPersonalFormLeaderboard({ /* target rows + friend rows */ });
  expect(result.entries[0]).toMatchObject({
    faceitId: "friend-a",
    gamesPlayed: 3,
    avgKd: 1.5,
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/lib/stats-leaderboard.test.ts`

Expected: FAIL because the current helper still computes stats from shared matches only.

**Step 3: Write minimal implementation**

Refactor `src/lib/stats-leaderboard.ts` so it exposes a helper oriented around the new product behavior. It should:
- accept all recent rows for the target player and candidate friends
- identify eligible friends from recent shared matches with the target
- aggregate each eligible friend's own latest `n` matches
- return:
  - `entries`
  - `targetMatchCount`
  - `sharedFriendCount`

Keep the aggregate shape as `StatsLeaderboardEntry`, but restore `gamesPlayed` to mean the player's own matches used.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/lib/stats-leaderboard.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/stats-leaderboard.ts tests/lib/stats-leaderboard.test.ts
git commit -m "✨ feat(stats): split queue eligibility from player form"
```

### Task 2: Rework the server query to use recent-queue eligibility plus personal form

**Files:**
- Modify: `src/server/matches.ts:34-64`
- Modify: `src/server/matches.ts:451-533`
- Modify: `tests/server/matches.test.ts`
- Modify: `tests/lib/stats-leaderboard.test.ts`

**Step 1: Write the failing test**

Add or update tests to prove the server contract now works like this:
- recent target-player matches determine which friends qualify
- included friends are then aggregated from their own recent rows
- `30 / 90 / 180 / 365` is accepted by the query and sync contracts
- refresh still collects enough data for the searched player's eligibility window

At least one server-boundary test should call `getStatsLeaderboard` and assert:
- only recently queued friends are returned
- the returned stats reflect the friend's own later matches

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/lib/stats-leaderboard.test.ts tests/server/matches.test.ts
```

Expected: FAIL because `getStatsLeaderboard` still routes through shared-match-only aggregation and only accepts `7 / 30 / 90`.

**Step 3: Write minimal implementation**

Update `src/server/matches.ts`:
- change all day unions from `7 | 30 | 90` to `30 | 90 | 180 | 365`
- keep `fetchPlayerHistoryWindow`, but use it to gather the target player's recent match window for eligibility
- query enough friend rows to compute each eligible player's own last `n` matches
- remove the current shared-match-only result building
- feed the server rows into the new helper from Task 1

Do not reintroduce the old "every friend always appears" behavior.

**Step 4: Run focused tests**

Run:

```bash
pnpm test -- tests/lib/stats-leaderboard.test.ts tests/server/matches.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/matches.ts tests/server/matches.test.ts tests/lib/stats-leaderboard.test.ts
git commit -m "✨ feat(server): rank recent queue by personal form"
```

### Task 3: Update client hooks, day presets, and explanatory copy

**Files:**
- Modify: `src/hooks/useStatsLeaderboard.ts`
- Modify: `src/hooks/useSyncPlayerHistory.ts`
- Modify: `src/routes/_authed/leaderboard.tsx`
- Modify: `src/lib/stats-leaderboard-copy.ts`
- Modify: `tests/lib/stats-leaderboard-copy.test.ts`

**Step 1: Write the failing test**

Update `tests/lib/stats-leaderboard-copy.test.ts` to reflect the approved wording:
- summary should explain eligibility plus personal-form stats
- day presets should support `30 / 90 / 180 / 365`
- empty states should say "recently queued friends", not "shared friends"

Add expectations like:

```ts
expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 90, 20)).toBe(
  "Showing players you queued with in the last 90 days. Stats are from each player's own last 20 matches."
);
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/lib/stats-leaderboard-copy.test.ts`

Expected: FAIL because the current copy still says `Recent squad leaderboard` and uses `7 / 30 / 90`.

**Step 3: Write minimal implementation**

Update the client layer so:
- `days` is `30 | 90 | 180 | 365`
- the UI day buttons are `30 / 90 / 180 / 365`
- summary copy explicitly states:
  - players are shown because you queued with them recently
  - stats are from each player's own last `N` matches
- empty-state copy says `No recently queued friends...`
- the initial prompt no longer implies a shared-match leaderboard

Keep sort controls and stat groups unchanged.

**Step 4: Run relevant tests**

Run:

```bash
pnpm test -- tests/lib/stats-leaderboard-copy.test.ts
pnpm test
```

Expected:
- copy test passes
- full suite stays green

**Step 5: Commit**

```bash
git add src/hooks/useStatsLeaderboard.ts src/hooks/useSyncPlayerHistory.ts src/routes/_authed/leaderboard.tsx src/lib/stats-leaderboard-copy.ts tests/lib/stats-leaderboard-copy.test.ts
git commit -m "💫 ui(leaderboard): explain personal form queue filter"
```

### Task 4: Final verification and smoke-check

**Files:**
- Review: `src/server/matches.ts`
- Review: `src/routes/_authed/leaderboard.tsx`
- Review: `src/lib/stats-leaderboard.ts`
- Review: `tests/lib/stats-leaderboard.test.ts`

**Step 1: Run final verification**

Run:

```bash
pnpm test
pnpm build
```

Expected:
- all Vitest files pass
- production build succeeds

**Step 2: Manual smoke check**

Run:

```bash
pnpm dev
```

Manual checks:
- search for `soavarice`
- confirm day presets show `30 / 90 / 180 / 365`
- confirm summary copy explicitly mentions recent queue filter plus personal recent matches
- confirm someone you queued with recently appears even if many of their scoring matches were not with you
- confirm someone not queued with recently is excluded
- confirm `GP` reflects each player's own recent sample size

**Step 3: Commit any final polish**

```bash
git add src/server/matches.ts src/routes/_authed/leaderboard.tsx src/lib/stats-leaderboard.ts src/lib/stats-leaderboard-copy.ts src/hooks/useStatsLeaderboard.ts src/hooks/useSyncPlayerHistory.ts tests/lib/stats-leaderboard.test.ts tests/server/matches.test.ts tests/lib/stats-leaderboard-copy.test.ts
git commit -m "✅ test(leaderboard): verify personal-form queue filter"
```

Skip this commit if there is no additional polish after verification.
