# Boneyard Skeleton Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~400 lines of hand-crafted `animate-pulse` skeleton divs across 4 routes and 1 component with `boneyard-js` `<Skeleton>` wrappers that auto-capture real layouts via a Vite plugin.

**Architecture:** Each component/section that has a loading state wraps its real content with `<Skeleton name="..." loading={...}>`. Routes pass loading flags as props instead of conditionally rendering hand-crafted divs. The Vite plugin (excluded from test runs) visits the app headlessly on dev start and generates `.bones.json` files that are committed to source control.

**Tech Stack:** boneyard-js, boneyard-js/react, boneyard-js/vite, React 19, Vite 8, TanStack React Start, Vitest

---

## File Map

| Action | File | Change |
|---|---|---|
| Create | `boneyard.config.json` | New config file |
| Modify | `vite.plugins.ts` | Add boneyardPlugin (non-test only) |
| Modify | `tests/setup.ts` | Global boneyard mock for all tests |
| Modify | `tests/routes/last-party-route.test.tsx` | Update skeleton testid assertions |
| Modify | `src/components/SeasonLeaderboardTab.tsx` | Add `loading` prop, wrap with Skeleton, delete skeleton block |
| Modify | `src/components/FriendsSidebar.tsx` | Add `loading` prop, wrap return with Skeleton |
| Modify | `src/routes/_authed/$nickname.tsx` | Remove skeleton conditional, add Skeleton wrappers |
| Modify | `src/routes/_authed/bets.tsx` | Replace skeleton block with Skeleton wrapper |
| Modify | `src/routes/_authed/last-party.tsx` | Replace skeleton block with Skeleton wrapper |
| Modify | `src/routes/_authed/match.$matchId.tsx` | Replace skeleton block with Skeleton wrapper |
| Create | `src/bones/*.bones.json` | Generated on first dev run, committed |

---

## Task 1: Install boneyard-js and configure

**Files:**
- Create: `boneyard.config.json`
- Modify: `vite.plugins.ts`

- [ ] **Step 1: Install the package**

```bash
pnpm add boneyard-js
```

Expected: `boneyard-js` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `boneyard.config.json` at the project root**

```json
{
  "breakpoints": [375, 768, 1280],
  "out": "./src/bones",
  "animate": "pulse"
}
```

- [ ] **Step 3: Add the Vite plugin to `vite.plugins.ts`**

Replace the full file content:

```ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { boneyardPlugin } from "boneyard-js/vite";
import { nitro } from "nitro/vite";
import type { PluginOption } from "vite";

export function createAppPlugins({
  isTest,
}: {
  isTest: boolean;
}): PluginOption[] {
  const plugins: PluginOption[] = [
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    tailwindcss(),
  ];

  if (!isTest) {
    plugins.splice(1, 0, nitro({ preset: "vercel" }));
    plugins.push(boneyardPlugin());
  }

  return plugins;
}
```

- [ ] **Step 4: Run the test suite to confirm nothing broke**

```bash
pnpm test
```

Expected: all 461 tests pass (boneyard-js/react is not yet imported by any source file, so no mock needed yet).

- [ ] **Step 5: Commit**

```bash
git add boneyard.config.json vite.plugins.ts package.json pnpm-lock.yaml
git commit -m "chore: install boneyard-js and configure vite plugin"
```

---

## Task 2: Add global boneyard mock for tests

All test files use `renderToStaticMarkup` or React Testing Library which run in Node.js — no DOM/headless-browser available. The `boneyard-js/react` `<Skeleton>` component must be mocked globally so tests don't crash and so `data-testid` props are forwarded correctly.

**Mock behaviour:**
- `loading=true` → renders a `<div>` with all forwarded props (including `data-testid`), no children
- `loading=false` → renders children directly (no wrapper)

**Files:**
- Modify: `tests/setup.ts`

- [ ] **Step 1: Replace `tests/setup.ts` content**

```ts
import React from "react";
import { vi } from "vitest";

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({
    loading,
    children,
    name: _name,
    ...props
  }: {
    loading: boolean;
    children?: React.ReactNode;
    name: string;
    [key: string]: unknown;
  }) =>
    loading
      ? React.createElement("div", props)
      : React.createElement(React.Fragment, null, children),
}));
```

The `name` prop is destructured and discarded (`_name`) to prevent it appearing as an HTML attribute in static markup.

- [ ] **Step 2: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass (mock is registered but no components use it yet).

- [ ] **Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "test: add global boneyard-js/react mock for vitest"
```

---

## Task 3: Update last-party route test for new skeleton shape

The test at `tests/routes/last-party-route.test.tsx:161-177` checks for two specific `data-testid` values (`last-party-podium-skeleton` and `last-party-rivalry-skeleton`) that live on hand-crafted divs. After migration, one `<Skeleton>` wraps the entire loading block with a single testid. Update the test before touching the route.

**Files:**
- Modify: `tests/routes/last-party-route.test.tsx`

- [ ] **Step 1: Update the "includes rivalry placeholders" test**

Find this block (around line 161–177):

```ts
it("includes rivalry placeholders in the loading skeleton", () => {
  mocks.trackedTarget = {
    data: null,
    isLoading: true,
    isError: false,
    isTrackedFlow: false,
  };
  mocks.session = {
    data: null,
    isLoading: true,
  };

  const html = renderRoute();

  expect(html).toContain('data-testid="last-party-podium-skeleton"');
  expect(html).toContain('data-testid="last-party-rivalry-skeleton"');
});
```

Replace with:

```ts
it("shows a loading skeleton for the page body while resolving", () => {
  mocks.trackedTarget = {
    data: null,
    isLoading: true,
    isError: false,
    isTrackedFlow: false,
  };
  mocks.session = {
    data: null,
    isLoading: true,
  };

  const html = renderRoute();

  expect(html).toContain('data-testid="last-party-loading-skeleton"');
});
```

- [ ] **Step 2: Run the test suite**

```bash
pnpm test
```

Expected: the updated test fails (the new testid doesn't exist in the route yet). All other 460 tests pass. Confirm the failure is specifically `last-party-route.test.tsx` and only the renamed test.

- [ ] **Step 3: Commit**

```bash
git add tests/routes/last-party-route.test.tsx
git commit -m "test: update last-party skeleton testid to match boneyard migration"
```

---

## Task 4: Migrate SeasonLeaderboardTab

**Files:**
- Modify: `src/components/SeasonLeaderboardTab.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import { Skeleton } from "boneyard-js/react";
import { useSeasonLeaderboard } from "~/hooks/useSeasonLeaderboard";
import type { Season } from "~/lib/types";

interface SeasonLeaderboardTabProps {
  season: Season;
  userId?: string | null;
  loading?: boolean;
}

export function SeasonLeaderboardTab({
  season,
  userId,
  loading,
}: SeasonLeaderboardTabProps) {
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useSeasonLeaderboard(season.id);

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load season leaderboard.
      </div>
    );
  }

  if (!isLoading && !(loading ?? false) && !entries.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No participants yet.
      </div>
    );
  }

  return (
    <Skeleton name="season-leaderboard" loading={isLoading || (loading ?? false)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div
            className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
          >
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Coins</span>
            <span className="text-right">Bets</span>
            <span className="text-right">Win %</span>
          </div>

          {entries.map((entry, index) => {
            const isCurrentUser = !!userId && entry.userId === userId;
            return (
              <div
                className={`grid gap-2 rounded px-3 py-2 text-sm ${
                  isCurrentUser
                    ? "border-accent border-l-2 bg-accent/10"
                    : "bg-bg-elevated"
                }`}
                key={entry.userId}
                style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
              >
                <span className="font-bold text-text-dim text-xs">
                  {index + 1}
                </span>
                <span
                  className={`truncate font-bold ${isCurrentUser ? "text-accent" : "text-text"}`}
                >
                  {entry.nickname}
                </span>
                <span className="text-right font-semibold text-text-muted text-xs">
                  {entry.coins}
                </span>
                <span className="text-right text-text-muted text-xs">
                  {entry.betsPlaced}
                </span>
                <span className="text-right text-text-muted text-xs">
                  {entry.winRate}%
                </span>
              </div>
            );
          })}
        </div>

        {season.prizes.length > 0 && (
          <div className="flex flex-col gap-3">
            {season.prizes.map((prize) => (
              <div
                className="relative overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 via-bg-elevated to-accent/5 p-4"
                key={prize.place}
              >
                <div className="flex items-center gap-4">
                  {prize.imageUrl && (
                    <div className="shrink-0">
                      <img
                        alt={prize.skinName ?? prize.description}
                        className="h-24 w-auto object-contain drop-shadow-[0_0_8px_rgba(80,250,123,0.3)]"
                        height={96}
                        src={prize.imageUrl}
                        width={96}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <span className="font-bold text-[10px] text-accent uppercase tracking-wider">
                        1st Place Prize
                      </span>
                    </div>
                    <div className="font-bold text-lg text-text">
                      {prize.skinName ?? prize.description}
                    </div>
                    {prize.wear && (
                      <div className="flex items-center gap-2 text-text-muted text-xs">
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent">
                          {prize.wear}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Skeleton>
  );
}
```

- [ ] **Step 2: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SeasonLeaderboardTab.tsx
git commit -m "refactor: migrate SeasonLeaderboardTab to boneyard skeleton"
```

---

## Task 5: Migrate FriendsSidebar

**Files:**
- Modify: `src/components/FriendsSidebar.tsx`

- [ ] **Step 1: Read the current full file to avoid missing any content**

Read `src/components/FriendsSidebar.tsx` in full before editing.

- [ ] **Step 2: Add `loading` prop and wrap the `<aside>` with `<Skeleton>`**

Add the import at the top of the file:
```ts
import { Skeleton } from "boneyard-js/react";
```

Add `loading?: boolean` to the `FriendsSidebarProps` interface and to the destructured parameters.

Wrap the returned `<aside>` element:
```tsx
return (
  <Skeleton name="friends-sidebar" loading={loading ?? false}>
    <aside className="h-full w-[260px] flex-shrink-0 overflow-y-auto border-border border-r bg-bg-card p-3">
      {/* existing aside content unchanged */}
    </aside>
  </Skeleton>
);
```

No other changes inside the component.

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/FriendsSidebar.tsx
git commit -m "refactor: migrate FriendsSidebar to boneyard skeleton"
```

---

## Task 6: Migrate $nickname.tsx

The route currently has three hand-crafted skeleton sections inside `searchLoading ? <big div> : ...`. Replace with Skeleton wrappers on the real layout.

**Files:**
- Modify: `src/routes/_authed/$nickname.tsx`

- [ ] **Step 1: Add the Skeleton import**

At the top of `src/routes/_authed/$nickname.tsx`, add:
```ts
import { Skeleton } from "boneyard-js/react";
```

- [ ] **Step 2: Replace the main layout conditional**

Find the block starting at `{searchLoading ? (` and ending at the closing `)}` of the entire conditional (currently around line 218–456). Replace it with:

```tsx
{searchError ? (
  <div className="flex flex-1 items-center justify-center text-error text-sm">
    Player &quot;{nickname}&quot; not found on FACEIT.
  </div>
) : hasTrackedPlayerMiss ? (
  <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
    No tracked player has recent activity yet.
  </div>
) : !searchLoading && enrichedFriends.length === 0 ? (
  <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
    This player has no friends on FACEIT.
  </div>
) : (
  <div className="relative flex flex-1 overflow-hidden">
    {/* Mobile sidebar overlay — only when loaded */}
    {!searchLoading && sidebarOpen && (
      <button
        aria-label="Close sidebar"
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={() => setSidebarOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setSidebarOpen(false);
          }
        }}
        type="button"
      />
    )}
    {/* Mobile sidebar drawer — only when loaded */}
    {!searchLoading && (
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <FriendsSidebar
          friends={enrichedFriends}
          onSelectFriend={(id) => {
            setSelectedFriendId(id);
            setSidebarOpen(false);
          }}
          selectedFriendId={selectedFriendId}
          twitchStreams={twitchStreams}
        />
      </aside>
    )}
    {/* Desktop sidebar with boneyard skeleton */}
    <div className="hidden lg:block">
      <FriendsSidebar
        friends={enrichedFriends}
        loading={searchLoading}
        onSelectFriend={setSelectedFriendId}
        selectedFriendId={selectedFriendId}
        twitchStreams={twitchStreams}
      />
    </div>
    {/* Main content with boneyard skeleton */}
    <Skeleton name="friends-main" loading={searchLoading}>
      <main className="flex-1 overflow-y-auto p-4">
        {/* Mobile toggle button */}
        <button
          className="mb-3 flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-3 py-1.5 text-text-muted text-xs lg:hidden"
          onClick={() => setSidebarOpen(true)}
          type="button"
        >
          <span className="text-sm">☰</span> Live Party (
          {enrichedFriends.length})
        </button>
        {liveStream && <TwitchEmbed stream={liveStream} />}
        {liveMatches.map((match) => (
          <LiveMatchCard
            key={match.matchId}
            match={match}
            seasonId={seasonId}
            userCoins={userCoins}
            userId={userId}
          />
        ))}
        {selectedFriendId ? (
          <Skeleton name="friends-stats" loading={statsLoading}>
            <RecentMatches matches={recentMatches} />
          </Skeleton>
        ) : (
          <div className="py-12 text-center text-sm text-text-dim">
            Select a friend to view their match history
          </div>
        )}
      </main>
    </Skeleton>
  </div>
)}
```

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/\$nickname.tsx
git commit -m "refactor: migrate \$nickname route to boneyard skeletons"
```

---

## Task 7: Migrate bets.tsx

The early return for `!authResolved || seasonLoading` contains the page-level skeleton. Keep the early return structure but replace the skeleton body with a single `<Skeleton>` wrapper.

**Files:**
- Modify: `src/routes/_authed/bets.tsx`

- [ ] **Step 1: Add the Skeleton import**

At the top of `src/routes/_authed/bets.tsx`, add:
```ts
import { Skeleton } from "boneyard-js/react";
```

- [ ] **Step 2: Replace the loading early return**

Find (around line 182–227):
```tsx
if (!authResolved || seasonLoading) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {/* Season header skeleton */}
          ...all the hand-crafted pulse divs...
        </div>
      </div>
    </div>
  );
}
```

Replace with:
```tsx
if (!authResolved || seasonLoading) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          <Skeleton name="bets-page" loading={true}>{null}</Skeleton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/bets.tsx
git commit -m "refactor: migrate bets route to boneyard skeleton"
```

---

## Task 8: Migrate last-party.tsx

The loading block is an inline conditional (not an early return). It currently renders 7 hand-crafted skeleton sections. Replace with one `<Skeleton>` wrapper carrying the `data-testid` the test expects.

**Files:**
- Modify: `src/routes/_authed/last-party.tsx`

- [ ] **Step 1: Add the Skeleton import**

At the top of `src/routes/_authed/last-party.tsx`, add:
```ts
import { Skeleton } from "boneyard-js/react";
```

- [ ] **Step 2: Replace the inline loading block**

Find (around line 176–350):
```tsx
{(resolving || sessionLoading) && urlPlayer && (
  <div className="flex flex-col gap-6">
    {/* LastPartyHeader skeleton */}
    ...all the hand-crafted pulse divs...
  </div>
)}
```

Replace with:
```tsx
{(resolving || sessionLoading) && urlPlayer && (
  <Skeleton
    data-testid="last-party-loading-skeleton"
    loading={true}
    name="last-party-body"
  >
    {null}
  </Skeleton>
)}
```

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass, including the updated "shows a loading skeleton for the page body while resolving" test.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/last-party.tsx
git commit -m "refactor: migrate last-party route to boneyard skeleton"
```

---

## Task 9: Migrate match.$matchId.tsx

The early return for `isLoading` contains five hand-crafted skeleton sections. Replace with a single `<Skeleton>` wrapper.

**Files:**
- Modify: `src/routes/_authed/match.$matchId.tsx`

- [ ] **Step 1: Add the Skeleton import**

At the top of `src/routes/_authed/match.$matchId.tsx`, add:
```ts
import { Skeleton } from "boneyard-js/react";
```

- [ ] **Step 2: Replace the loading early return**

Find (around line 34–172):
```tsx
if (isLoading) {
  return (
    <div className="mx-auto max-w-6xl p-4">
      {/* Match header skeleton */}
      ...all the hand-crafted pulse divs...
    </div>
  );
}
```

Replace with:
```tsx
if (isLoading) {
  return (
    <div className="mx-auto max-w-6xl p-4">
      <Skeleton name="match-detail" loading={true}>{null}</Skeleton>
    </div>
  );
}
```

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all 461 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authed/match.\$matchId.tsx
git commit -m "refactor: migrate match detail route to boneyard skeleton"
```

---

## Task 10: Capture bones and commit

The Vite plugin visits the app in a headless browser when the dev server starts, finds all `<Skeleton name="...">` components, and generates `.bones.json` files in `./src/bones/`. These files must be committed so production builds work without a browser.

**Files:**
- Create: `src/bones/*.bones.json` (8 files, one per named skeleton)

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Wait for the server to be ready (port 3000). The boneyard Vite plugin will log something like `[boneyard] capturing bones...` or similar. Wait until capture is complete (headless browser finishes visiting all routes that have `<Skeleton>` components).

Skeletons that will be captured:
- `season-leaderboard` — visit `/bets` → `Leaderboard` tab
- `friends-sidebar` — visit `/$nickname` (any loaded player)
- `friends-main` — same page, loaded state
- `friends-stats` — same page with a friend selected and stats loaded
- `bets-page` — visit `/bets` (loaded state)
- `last-party-body` — visit `/last-party` with a player and date
- `match-detail` — visit `/match/$matchId` (any loaded match)

- [ ] **Step 2: Verify bones files were generated**

```bash
ls src/bones/
```

Expected: 8 `.bones.json` files, one per skeleton name.

- [ ] **Step 3: Commit the bones files**

```bash
git add src/bones/
git commit -m "feat: add boneyard bones files for all skeleton components"
```

- [ ] **Step 4: Run the full test suite one final time**

```bash
pnpm test
```

Expected: all 461 tests pass.

---

## Self-Review Notes

- **Spec coverage:** All 8 skeleton boundaries from the spec have tasks. Vite plugin config, `boneyard.config.json`, test mock, bones commit — all covered.
- **Test IDs:** The `last-party-route.test.tsx` test update (Task 3) happens BEFORE the route migration (Task 8) so the failing test gates the implementation correctly.
- **`SeasonLeaderboardTab` dual loading:** The component combines `isLoading` (its own query) with the `loading` prop from `bets.tsx`. The condition `isLoading || (loading ?? false)` is used consistently.
- **Empty state guard:** `!isLoading && !(loading ?? false) && !entries.length` ensures the "No participants yet" state doesn't flash during loading.
- **Mobile sidebar:** Wrapped in `!searchLoading` guards so it doesn't render a broken drawer while loading; only the desktop sidebar uses boneyard.
- **Bones not present in CI:** Production builds use committed `.bones.json` files. If a developer adds a new `<Skeleton>` without running dev to capture, boneyard falls back to rendering nothing (no crash). Document this in the PR.
