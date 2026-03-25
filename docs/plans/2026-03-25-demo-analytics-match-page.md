# Demo Analytics Match Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a FACEIT-backed match page that upgrades into a full demo-analytics dashboard when a parsed CS2 demo is available, with support for both FACEIT demo URLs and manual demo attachment.

**Architecture:** Keep the existing FACEIT match fetch path as the baseline render path. Add normalized demo ingestion and analytics tables, parse demos into per-match, per-team, per-player, and per-round rollups, then join those analytics into the match page response and render an analyst-style dashboard only when parsed data exists.

**Tech Stack:** TanStack Start, TanStack Router, TanStack Query, React 19, Supabase, `@laihoe/demoparser2`, `fzstd`, Vitest

---

### Task 1: Lock The Analytics Contracts In Types And Tests

**Files:**
- Modify: `src/lib/types.ts`
- Create: `tests/lib/demo-analytics-types.test.ts`

**Step 1: Write the failing type-shape tests**

Create `tests/lib/demo-analytics-types.test.ts` with narrow runtime assertions around sample fixtures for:

- `DemoIngestionStatus`
- `DemoAnalyticsSourceType`
- `DemoMatchAnalytics`
- `DemoPlayerAnalytics`
- `DemoTeamAnalytics`
- `DemoRoundAnalytics`
- `MatchDetailWithDemoAnalytics`

Use fixtures that assert fields such as:

```ts
const player = {
  nickname: "TibaBG",
  teamKey: "team1",
  tradeKills: 3,
  untradedDeaths: 4,
  rws: 13.8,
};
```

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/lib/demo-analytics-types.test.ts
```

Expected: FAIL because the new demo analytics types do not exist.

**Step 3: Add the minimal type layer**

Extend `src/lib/types.ts` with:

- `DemoIngestionStatus`
- `DemoAnalyticsSourceType`
- `DemoAnalyticsAvailability`
- `DemoMatchAnalytics`
- `DemoPlayerAnalytics`
- `DemoTeamAnalytics`
- `DemoRoundAnalytics`
- `MatchDetailWithDemoAnalytics`

Do not add UI-only formatting fields here.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/lib/demo-analytics-types.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/types.ts tests/lib/demo-analytics-types.test.ts
git commit -m "✨ feat(types): add demo analytics contracts"
```

### Task 2: Add Pure Demo Metric Helpers Before Parser Wiring

**Files:**
- Create: `src/lib/demo-analytics.ts`
- Create: `tests/lib/demo-analytics.test.ts`

**Step 1: Write the failing helper tests**

Create `tests/lib/demo-analytics.test.ts` for small pure helpers:

- `classifyTradeKill`
- `classifyExitKill`
- `buildRoundScoreProgression`
- `buildWinLossStreaks`
- `computeRwsForRound`

Cover edge cases:

- no team damage in a won round
- bomb bonus round
- no trade within the configured window
- last round in a half

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/lib/demo-analytics.test.ts
```

Expected: FAIL because the helper module does not exist.

**Step 3: Implement the minimal helper module**

Create `src/lib/demo-analytics.ts` with pure functions only. Keep it parser-agnostic so parser code and future summary queries can both reuse it.

Use explicit constants for:

- trade window in seconds or ticks
- RWS bomb bonus
- fallback equal-share logic

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/lib/demo-analytics.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/demo-analytics.ts tests/lib/demo-analytics.test.ts
git commit -m "✨ feat(parser): add demo metric helpers"
```

### Task 3: Add Supabase Schema For Ingestion And Analytics

**Files:**
- Create: `supabase/migrations/004_demo_analytics.sql`
- Test: `supabase/migrations/004_demo_analytics.sql`

**Step 1: Write the schema draft**

Add migration SQL for:

- `demo_ingestions`
- `demo_match_analytics`
- `demo_team_analytics`
- `demo_player_analytics`
- `demo_round_analytics`

Include:

- primary keys
- unique constraints on `faceit_match_id` where appropriate
- status checks
- foreign keys between analytics tables and the ingestion or match row
- indexes for `faceit_match_id`, `faceit_player_id`, and status lookups

**Step 2: Run the migration locally**

Run the project’s Supabase migration flow or apply the SQL in your local database environment.

Expected: the migration applies cleanly.

**Step 3: Adjust the schema until it applies**

Make only the minimal corrections needed to get clean DDL and useful indexes.

**Step 4: Verify the schema exists**

Run a table listing or schema inspection command in your local Supabase environment.

Expected: all five tables and their key indexes are present.

**Step 5: Commit**

```bash
git add supabase/migrations/004_demo_analytics.sql
git commit -m "🗃️ db(demo): add demo ingestion and analytics tables"
```

### Task 4: Build A Local Parser Smoke Test Around The Known Demo

**Files:**
- Create: `src/server/demo-parser.ts`
- Create: `tests/server/demo-parser.test.ts`
- Optional fixture reference: `/Users/ventsislav.nikolov/Downloads/1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3-1-1.dem.zst`

**Step 1: Write the failing parser smoke test**

Create `tests/server/demo-parser.test.ts` to assert that a parser function can:

- decompress a `.dem.zst`
- read the header
- extract player info
- parse required events
- produce a minimal match analytics payload

Assert known values from the supplied demo:

- map is `de_inferno`
- player count is `10`
- total rounds is `20`

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/demo-parser.test.ts
```

Expected: FAIL because `src/server/demo-parser.ts` does not exist.

**Step 3: Implement the minimal parser wrapper**

Create `src/server/demo-parser.ts` that:

- accepts a local file path
- decompresses `.zst` files when needed
- uses `@laihoe/demoparser2`
- reads `parseHeader`, `parsePlayerInfo`, and the event streams needed for v1
- returns a lightweight structured result without any DB writes yet

Keep this first version local-file-based only.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/demo-parser.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/demo-parser.ts tests/server/demo-parser.test.ts
git commit -m "✨ feat(parser): add local CS2 demo parser smoke test"
```

### Task 5: Persist Parsed Analytics To Supabase

**Files:**
- Modify: `src/server/demo-parser.ts`
- Create: `src/server/demo-analytics-store.ts`
- Create: `tests/server/demo-analytics-store.test.ts`

**Step 1: Write the failing persistence tests**

Create `tests/server/demo-analytics-store.test.ts` covering:

- ingestion row upsert
- match analytics insert
- player analytics upsert for 10 players
- round analytics insert for 20 rounds
- parser failure updates the ingestion status to `failed`

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/demo-analytics-store.test.ts
```

Expected: FAIL because the store module does not exist.

**Step 3: Implement the minimal storage layer**

Create `src/server/demo-analytics-store.ts` with small functions:

- `upsertDemoIngestion`
- `markDemoIngestionParsing`
- `markDemoIngestionFailed`
- `saveDemoAnalytics`

Update `src/server/demo-parser.ts` so it can hand off a parsed result to the store module.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/demo-analytics-store.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/demo-parser.ts src/server/demo-analytics-store.ts tests/server/demo-analytics-store.test.ts
git commit -m "✨ feat(parser): persist parsed demo analytics"
```

### Task 6: Extend Match Detail Server Output To Include Demo Analytics

**Files:**
- Modify: `src/server/matches.ts`
- Create: `tests/server/matches.demo-analytics.test.ts`

**Step 1: Write the failing match-detail tests**

Create `tests/server/matches.demo-analytics.test.ts` to assert:

- baseline match detail still returns without demo analytics
- parsed analytics are merged when present
- ingestion status is returned when analytics are missing
- source type is surfaced

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/matches.demo-analytics.test.ts
```

Expected: FAIL because `getMatchDetails` does not include demo analytics.

**Step 3: Implement the minimal server merge**

Update `src/server/matches.ts` to:

- read the ingestion and analytics tables by `matchId`
- return a richer shape compatible with `MatchDetailWithDemoAnalytics`
- keep existing FACEIT and `match_player_stats` behavior intact

Do not add parsing triggers here yet.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/matches.demo-analytics.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/matches.ts tests/server/matches.demo-analytics.test.ts
git commit -m "✨ feat(match): expose demo analytics on match detail"
```

### Task 7: Upgrade The Match Route To An Analyst Dashboard Shell

**Files:**
- Modify: `src/routes/_authed/match.$matchId.tsx`
- Create: `src/hooks/useMatchDetail.ts`
- Create: `src/components/DemoAnalyticsStatusPanel.tsx`
- Create: `tests/routes/match-detail-route.test.tsx`

**Step 1: Write the failing route tests**

Create `tests/routes/match-detail-route.test.tsx` covering:

- FACEIT baseline render when no demo analytics exist
- analytics status panel render for `queued`, `parsing`, and `failed`
- analyst dashboard shell render when analytics exist

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/routes/match-detail-route.test.tsx
```

Expected: FAIL because the route still renders the live-shell layout.

**Step 3: Implement the minimal route refactor**

Create `src/hooks/useMatchDetail.ts` as the route data hook.

Update `src/routes/_authed/match.$matchId.tsx` to:

- fetch the richer match detail payload
- render a dedicated match analytics layout
- show `DemoAnalyticsStatusPanel`
- remove the dependency on the current live-only layout assumptions

Do not implement the full analyst visuals yet. Only create the shell and state branching.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/routes/match-detail-route.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/routes/_authed/match.$matchId.tsx src/hooks/useMatchDetail.ts src/components/DemoAnalyticsStatusPanel.tsx tests/routes/match-detail-route.test.tsx
git commit -m "💫 ui(match): add demo analytics match page shell"
```

### Task 8: Build The Analyst Dashboard Components

**Files:**
- Create: `src/components/MatchAnalyticsScoreboard.tsx`
- Create: `src/components/RoundTimeline.tsx`
- Create: `src/components/TeamSummaryCards.tsx`
- Create: `src/components/PlayerAnalyticsDetail.tsx`
- Modify: `src/routes/_authed/match.$matchId.tsx`
- Test: `tests/components/match-analytics-scoreboard.test.tsx`
- Test: `tests/components/round-timeline.test.tsx`

**Step 1: Write the failing component tests**

Add component tests for:

- scoreboard sorting and selected-player state
- timeline rendering of 20 rounds
- side and pistol markers
- team summary card rendering

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/components/match-analytics-scoreboard.test.tsx tests/components/round-timeline.test.tsx
```

Expected: FAIL because the new components do not exist.

**Step 3: Implement the minimal analyst components**

Create the new components and wire them into the match route.

Follow the validated visual direction:

- close to the attached analyst dashboard
- adapted to current app tokens and layout
- keep the UI modular

Start with:

- scoreboard
- round timeline
- team summary cards
- selected-player detail card

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/components/match-analytics-scoreboard.test.tsx tests/components/round-timeline.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/MatchAnalyticsScoreboard.tsx src/components/RoundTimeline.tsx src/components/TeamSummaryCards.tsx src/components/PlayerAnalyticsDetail.tsx src/routes/_authed/match.$matchId.tsx tests/components/match-analytics-scoreboard.test.tsx tests/components/round-timeline.test.tsx
git commit -m "💫 ui(match): add analyst dashboard components"
```

### Task 9: Add FACEIT Fetch Trigger And Manual Attach Trigger

**Files:**
- Create: `src/routes/api/faceit/demo-parse.tsx`
- Create: `src/server/demo-ingestion.ts`
- Modify: `src/components/DemoAnalyticsStatusPanel.tsx`
- Test: `tests/server/demo-ingestion.test.ts`

**Step 1: Write the failing ingestion tests**

Create `tests/server/demo-ingestion.test.ts` for:

- queuing a parse from a FACEIT `demoUrl`
- marking `source_unavailable` when no source exists
- creating a manual-upload ingestion row placeholder
- deduplicating an already queued or parsed match

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/demo-ingestion.test.ts
```

Expected: FAIL because the ingestion service does not exist.

**Step 3: Implement the minimal ingestion service**

Create `src/server/demo-ingestion.ts` with:

- `queueFaceitDemoParse`
- `queueManualDemoParse`
- `getDemoIngestionForMatch`

Add `src/routes/api/faceit/demo-parse.tsx` for the FACEIT-triggered action.

Update `DemoAnalyticsStatusPanel` to show buttons or actions for:

- `Fetch from FACEIT demo`
- `Attach manual demo`

The manual path can be a UI placeholder if file upload plumbing is not yet built, but the ingestion contract should be present.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/demo-ingestion.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/routes/api/faceit/demo-parse.tsx src/server/demo-ingestion.ts src/components/DemoAnalyticsStatusPanel.tsx tests/server/demo-ingestion.test.ts
git commit -m "✨ feat(demo): add ingestion triggers for match page"
```

### Task 10: Add Player Demo-Sample Summary Read Helpers

**Files:**
- Create: `src/server/demo-player-summaries.ts`
- Create: `tests/server/demo-player-summaries.test.ts`

**Step 1: Write the failing summary tests**

Create `tests/server/demo-player-summaries.test.ts` covering:

- aggregate per-player metrics across parsed demos
- always returning `sampleMatchCount`
- correct behavior for a sample of `1`
- correct behavior for a sample of `5`

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test tests/server/demo-player-summaries.test.ts
```

Expected: FAIL because the summary helper does not exist.

**Step 3: Implement the minimal aggregate reader**

Create `src/server/demo-player-summaries.ts` that queries `demo_player_analytics` and returns:

- aggregate averages
- totals where appropriate
- `sampleMatchCount`

Do not add this to the UI yet unless time remains.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test tests/server/demo-player-summaries.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server/demo-player-summaries.ts tests/server/demo-player-summaries.test.ts
git commit -m "✨ feat(stats): add demo sample player summaries"
```

### Task 11: Verify The Full Slice And Update Docs

**Files:**
- Modify: `docs/plans/2026-03-25-demo-analytics-match-page-design.md`
- Modify: `docs/plans/2026-03-25-demo-analytics-match-page.md`

**Step 1: Run targeted tests**

Run:

```bash
pnpm test tests/lib/demo-analytics-types.test.ts tests/lib/demo-analytics.test.ts tests/server/demo-parser.test.ts tests/server/demo-analytics-store.test.ts tests/server/matches.demo-analytics.test.ts tests/routes/match-detail-route.test.tsx tests/components/match-analytics-scoreboard.test.tsx tests/components/round-timeline.test.tsx tests/server/demo-ingestion.test.ts tests/server/demo-player-summaries.test.ts
```

Expected: PASS.

**Step 2: Run the broader suite**

Run:

```bash
pnpm test
```

Expected: PASS, or record any unrelated failures explicitly.

**Step 3: Manually verify the provided match**

Use the known FACEIT match:

- `1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3`

Verify:

- baseline match data renders
- parsed analytics render
- round timeline shows 20 rounds
- selected-player analytics update correctly
- source label is correct

**Step 4: Update docs if implementation diverged**

Adjust the design and plan docs only if implementation required a real deviation.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-25-demo-analytics-match-page-design.md docs/plans/2026-03-25-demo-analytics-match-page.md
git commit -m "📝 docs(demo): finalize demo analytics plan and notes"
```
