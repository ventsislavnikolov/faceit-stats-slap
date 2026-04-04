# Last Party Session Rivalry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a session-local rivalry layer to `/last-party` with a podium, rivalry cards, explainable session scores, and match-level rivalry receipts.

**Architecture:** Extend the existing `getPartySessionStats` read path to compute rivalry data in `src/lib/last-party.ts`, return that richer shape through `PartySessionData`, and render it with a small set of focused `last-party` components. Keep the first version read-only, deterministic, and fully degradable to FACEIT-only data when demo coverage is partial.

**Tech Stack:** TanStack Start, TanStack Query, React 19, TypeScript, Tailwind CSS, Vitest.

---

## Baseline Notes

- Worktree: `/Users/ventsislavnikolov/Projects/ventsislavnikolov/faceit-stats-slap/.worktrees/last-party-session-rivalry`
- Branch: `feat/last-party-session-rivalry`
- Baseline command: `pnpm test`
- Baseline status: failing before this feature work
- Known failing suites:
  - `tests/lib/stats-leaderboard.test.ts`
  - `tests/server/bet-history.test.ts`
  - `tests/server/betting-additional.test.ts`
  - `tests/server/friends.test.ts`
  - `tests/server/matches-api.test.ts`
  - `tests/server/matches.demo-analytics.test.ts`
- Failure class: imports a missing `@tanstack/start-storage-context` path from `../../node_modules/.pnpm/...`

Treat those failures as pre-existing unless the implementation work chooses to fix the baseline first. During feature work, prefer targeted tests for touched files, then run the full suite at the end and report baseline failures separately if they remain unchanged.

### Task 1: Define rivalry data types

**Files:**
- Modify: `src/lib/types.ts`
- Test: `tests/lib/last-party.test.ts`

**Step 1: Write the failing type-driven test updates**

Add assertions in `tests/lib/last-party.test.ts` that exercise a rivalry-aware aggregate result shape, for example:

```ts
expect(result.p1.sessionScore).toBeDefined();
expect(result.p1.scoreBreakdown).toBeDefined();
```

If the existing fixture shape is too narrow, add a new test block for rivalry-specific helper outputs instead of overloading the aggregate test.

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/lib/last-party.test.ts`

Expected: FAIL because `AggregatePlayerStats` and `PartySessionData` do not yet expose rivalry fields.

**Step 3: Extend the types with rivalry-specific interfaces**

In `src/lib/types.ts`, add:

- `SessionScoreCategory`
- `SessionScoreBreakdown`
- `SessionPodiumEntry`
- `SessionRivalryCard`
- `SessionRivalryData`

Then extend:

- `AggregatePlayerStats` with `sessionScore?`, `scoreBreakdown?`, `bestMapId?`, `worstMapId?`
- `PartySessionData` with a top-level `rivalries: SessionRivalryData`

Prefer explicit interfaces over loose `Record<string, unknown>`.

**Step 4: Run the targeted test to verify it passes**

Run: `pnpm vitest run tests/lib/last-party.test.ts`

Expected: PASS for type-level or fixture-shape expectations.

**Step 5: Commit**

```bash
git add src/lib/types.ts tests/lib/last-party.test.ts
git commit -m "✨ feat(last-party): add rivalry data types"
```

### Task 2: Build pure rivalry scoring helpers in `src/lib/last-party.ts`

**Files:**
- Modify: `src/lib/last-party.ts`
- Modify: `tests/lib/last-party.test.ts`

**Step 1: Write failing pure-function tests**

Add focused tests for:

- `buildSessionRivalries()` returns a sorted podium
- head-to-head results are computed from shared session maps only
- partial-demo sessions fall back to FACEIT-safe categories
- ties break alphabetically after score and category checks
- rivalry cards suppress fragile claims for tiny samples

Use compact fixtures, for example:

```ts
const rivalry = buildSessionRivalries({
  aggregateStats,
  allHaveDemo: false,
  demoMatches: {},
  eloMap,
  matchStats,
  matches,
  partyMemberIds: ["p1", "p2", "p3"],
});
expect(rivalry.podium[0]?.nickname).toBe("Alice");
expect(rivalry.rivalryCards.some((c) => c.id === "closest-duel")).toBe(true);
```

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/lib/last-party.test.ts`

Expected: FAIL because `buildSessionRivalries` and helper logic do not exist.

**Step 3: Implement pure rivalry helpers**

Add small pure helpers in `src/lib/last-party.ts`:

- `computeSessionCategoryScores`
- `computeHeadToHeadResults`
- `pickRivalryCards`
- `buildSessionRivalries`

Keep the scoring model conservative:

- FACEIT-only: `combatImpact`, `winningImpact`, `consistency`, `popOff`
- Demo-only extras: `entryEdge`, `tradeValue`, `clutchValue`, `utilityValue`, `economyEdge`

Use deterministic tie-breaking:

1. total session score
2. category wins
3. head-to-head result
4. nickname ascending

Do not perform any I/O here.

**Step 4: Attach rivalry output to aggregate rows**

Either:

- return `playerBreakdowns` separately and merge later, or
- enrich the aggregate rows after rivalry computation

Prefer whichever keeps `computeAggregateStats()` simple and `buildSessionRivalries()` the owner of scoring.

**Step 5: Run the targeted tests to verify they pass**

Run: `pnpm vitest run tests/lib/last-party.test.ts`

Expected: PASS with rivalry coverage added.

**Step 6: Commit**

```bash
git add src/lib/last-party.ts tests/lib/last-party.test.ts
git commit -m "✨ feat(last-party): add rivalry scoring helpers"
```

### Task 3: Integrate rivalry data into the server response

**Files:**
- Modify: `src/server/matches.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/server/last-party-session.test.ts`

**Step 1: Write a failing server test**

Create `tests/server/last-party-session.test.ts` that mocks the existing data pipeline and asserts:

- `getPartySessionStats()` returns `rivalries`
- podium entries align with deterministic fixture stats
- partial-demo inputs still return rivalry data with reduced categories

Use the server test style already present in `tests/server/*.test.ts`, but keep the scope limited to `getPartySessionStats`.

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/server/last-party-session.test.ts`

Expected: FAIL because the handler does not yet compute or return rivalry data.

**Step 3: Wire rivalry computation into `getPartySessionStats`**

Update `src/server/matches.ts` around the current aggregate section near `getPartySessionStats`:

- import `buildSessionRivalries` from `~/lib/last-party`
- compute rivalry output after `aggregateStats` and before the final return
- return the new `rivalries` payload

Keep the call order:

1. aggregate stats
2. map distribution
3. awards
4. rivalries
5. final response

**Step 4: Run the targeted test to verify it passes**

Run: `pnpm vitest run tests/server/last-party-session.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/matches.ts src/lib/types.ts tests/server/last-party-session.test.ts
git commit -m "✨ feat(last-party): return rivalry session data"
```

### Task 4: Add podium and rivalry card UI

**Files:**
- Create: `src/components/last-party/SessionPodium.tsx`
- Create: `src/components/last-party/SessionRivalryCards.tsx`
- Modify: `src/routes/_authed/last-party.tsx`
- Test: `tests/components/session-podium.test.tsx`
- Test: `tests/components/session-rivalry-cards.test.tsx`

**Step 1: Write the failing component tests**

Create tests that assert:

- podium ranks players in descending session-score order
- rivalry cards render only when cards are present
- badges and verdict strings are visible

Example:

```tsx
render(<SessionPodium entries={podium} />);
expect(screen.getByText("1")).toBeInTheDocument();
expect(screen.getByText("Alice")).toBeInTheDocument();
expect(screen.getByText("Carry")).toBeInTheDocument();
```

**Step 2: Run the targeted tests to verify they fail**

Run:

- `pnpm vitest run tests/components/session-podium.test.tsx`
- `pnpm vitest run tests/components/session-rivalry-cards.test.tsx`

Expected: FAIL because the components do not exist.

**Step 3: Implement the new components**

Build focused presentational components:

- `SessionPodium`
  - accepts `SessionPodiumEntry[]`
  - renders top 3 with score, badge, verdict
- `SessionRivalryCards`
  - accepts `SessionRivalryCard[]`
  - renders card title, subtitle, supporting evidence

Keep the copy short and high-contrast. Reuse existing `last-party` visual language.

**Step 4: Wire them into the route**

Update `src/routes/_authed/last-party.tsx` to render:

- `SessionPodium` below `LastPartyHeader`
- `SessionRivalryCards` below the podium

Also add loading skeleton placeholders for these sections while preserving the existing loading structure.

**Step 5: Run the targeted tests to verify they pass**

Run:

- `pnpm vitest run tests/components/session-podium.test.tsx`
- `pnpm vitest run tests/components/session-rivalry-cards.test.tsx`

Expected: PASS

**Step 6: Commit**

```bash
git add src/components/last-party/SessionPodium.tsx src/components/last-party/SessionRivalryCards.tsx src/routes/_authed/last-party.tsx tests/components/session-podium.test.tsx tests/components/session-rivalry-cards.test.tsx
git commit -m "✨ feat(last-party): add podium and rivalry cards"
```

### Task 5: Upgrade the session stats table with Session Score and evidence

**Files:**
- Modify: `src/components/last-party/SessionStatsTable.tsx`
- Create: `src/components/last-party/PlayerSessionBreakdown.tsx`
- Test: `tests/components/session-stats-table.test.tsx`

**Step 1: Write the failing component test**

Add a test that asserts:

- `Session Score` appears as the leading numeric column
- table sorts by `sessionScore` before fallback metrics
- expanding a player row reveals breakdown reasons

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/components/session-stats-table.test.tsx`

Expected: FAIL because the current table has no `Session Score` column or breakdown drawer.

**Step 3: Implement the table changes**

Update `SessionStatsTable` to:

- sort by `sessionScore ?? avgImpact`
- add the `Session Score` column before `Impact`
- support row expansion for evidence

Add `PlayerSessionBreakdown.tsx` to show:

- category scores
- strongest reason
- weakest category
- best map
- worst map

Keep the drawer lightweight. Avoid nested tables.

**Step 4: Run the targeted test to verify it passes**

Run: `pnpm vitest run tests/components/session-stats-table.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/last-party/SessionStatsTable.tsx src/components/last-party/PlayerSessionBreakdown.tsx tests/components/session-stats-table.test.tsx
git commit -m "✨ feat(last-party): add session score breakdown table"
```

### Task 6: Add match-level rivalry receipts to the accordion

**Files:**
- Modify: `src/components/last-party/MatchAccordion.tsx`
- Test: `tests/components/match-accordion-rivalry.test.tsx`

**Step 1: Write the failing component test**

Add a test that asserts expanded match content shows:

- best party player
- weakest party player
- optional `swing player` when fixture data supports it

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/components/match-accordion-rivalry.test.tsx`

Expected: FAIL because the rivalry strip does not exist.

**Step 3: Implement the rivalry strip**

In `MatchAccordion.tsx`:

- compute per-match party ordering from the same impact/session helper inputs used elsewhere
- render a compact strip above the banter block or just below the table
- keep the display terse: labels plus nickname, not long prose

Do not duplicate the full podium logic here. This is a per-match receipt, not a second ranking system.

**Step 4: Run the targeted test to verify it passes**

Run: `pnpm vitest run tests/components/match-accordion-rivalry.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/last-party/MatchAccordion.tsx tests/components/match-accordion-rivalry.test.tsx
git commit -m "✨ feat(last-party): add rivalry receipts to match accordion"
```

### Task 7: End-to-end route verification for `/last-party`

**Files:**
- Create: `tests/routes/last-party-route.test.tsx`
- Modify: `src/routes/_authed/last-party.tsx` if needed

**Step 1: Write the failing route test**

Cover:

- rivalry sections render for a populated session
- rivalry sections degrade cleanly for FACEIT-only or tiny sessions
- empty state still works
- loading skeleton includes rivalry placeholders

**Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run tests/routes/last-party-route.test.tsx`

Expected: FAIL until the route and mocks line up with the new rivalry-aware data shape.

**Step 3: Make the smallest route fixes needed**

Adjust the route only if the new test exposes problems such as:

- missing guards for absent rivalry data
- unstable loading layout
- incorrect placement order of podium/cards/table

Prefer keeping the route as a thin composition layer.

**Step 4: Run the targeted test to verify it passes**

Run: `pnpm vitest run tests/routes/last-party-route.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/_authed/last-party.tsx tests/routes/last-party-route.test.tsx
git commit -m "✅ test(last-party): verify rivalry route states"
```

### Task 8: Final verification and cleanup

**Files:**
- Review: `src/lib/types.ts`
- Review: `src/lib/last-party.ts`
- Review: `src/server/matches.ts`
- Review: `src/routes/_authed/last-party.tsx`
- Review: `src/components/last-party/*.tsx`

**Step 1: Run feature-focused verification**

Run:

- `pnpm vitest run tests/lib/last-party.test.ts`
- `pnpm vitest run tests/server/last-party-session.test.ts`
- `pnpm vitest run tests/components/session-podium.test.tsx`
- `pnpm vitest run tests/components/session-rivalry-cards.test.tsx`
- `pnpm vitest run tests/components/session-stats-table.test.tsx`
- `pnpm vitest run tests/components/match-accordion-rivalry.test.tsx`
- `pnpm vitest run tests/routes/last-party-route.test.tsx`

Expected: all PASS

**Step 2: Run formatting and static checks**

Run:

- `pnpm check`

Expected: PASS

**Step 3: Run the full suite and record baseline status**

Run:

- `pnpm test`

Expected:

- all new `last-party` tests PASS
- the six known baseline suites may still fail unless fixed separately

**Step 4: Review git diff for scope**

Run:

- `git status --short`
- `git diff --stat`

Expected: only `last-party` rivalry files and tests are changed

**Step 5: Final commit**

```bash
git add src/lib/types.ts src/lib/last-party.ts src/server/matches.ts src/routes/_authed/last-party.tsx src/components/last-party tests/lib/last-party.test.ts tests/server/last-party-session.test.ts tests/components tests/routes/last-party-route.test.tsx
git commit -m "✨ feat(last-party): add session rivalry recap"
```
