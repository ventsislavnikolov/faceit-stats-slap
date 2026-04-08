# Tracked Player Alias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reserved `tracked` player alias that resolves to one active tracked player with matching data, keeps that resolved player stable across tabs, and shows tracked-specific empty states when no tracked player qualifies.

**Architecture:** Add one shared alias helper plus one server-side tracked resolver. Keep the current single-player pages intact by resolving `tracked` into a concrete player before existing loaders/hooks run, then carry a locked `resolvedPlayerId` through tab navigation and route search params.

**Tech Stack:** TanStack Router, TanStack Start server functions, React Query, Supabase, Vitest

---

### Task 1: Add Alias Primitives And Lockable URL Helpers

**Files:**
- Create: `src/lib/tracked-player-alias.ts`
- Modify: `src/lib/faceit-search.ts`
- Modify: `src/lib/player-view-shell.ts`
- Modify: `tests/lib/faceit-search.test.ts`
- Modify: `tests/lib/player-view-shell.test.ts`
- Test: `tests/lib/faceit-search.test.ts`
- Test: `tests/lib/player-view-shell.test.ts`

- [ ] **Step 1: Write the failing alias helper and routing tests**

```ts
// tests/lib/faceit-search.test.ts
it("treats tracked as a reserved player alias", () => {
  expect(resolveFaceitSearchTarget("tracked")).toEqual({
    kind: "player",
    value: "tracked",
  });
});

// tests/lib/player-view-shell.test.ts
it("carries a locked resolved player id when the source player is tracked", () => {
  expect(
    getPlayerViewHref("history", "tracked", {
      resolvedPlayerId: "player-123",
    })
  ).toEqual({
    to: "/history",
    search: {
      player: "tracked",
      resolvedPlayerId: "player-123",
      matches: 20,
      queue: "party",
    },
  });
});

it("builds /tracked for the tracked friends view", () => {
  expect(getPlayerViewHref("friends", "tracked")).toEqual({
    to: "/tracked",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/faceit-search.test.ts tests/lib/player-view-shell.test.ts`
Expected: FAIL because `getPlayerViewHref` does not accept locked resolution metadata and the tracked friends route does not exist yet.

- [ ] **Step 3: Add the alias helper and extend player-view href generation**

```ts
// src/lib/tracked-player-alias.ts
export const TRACKED_PLAYER_ALIAS = "tracked";

export function isTrackedPlayerAlias(input: string | null | undefined): boolean {
  return input?.trim().toLowerCase() === TRACKED_PLAYER_ALIAS;
}

export type TrackedResolutionSearch = {
  resolvedPlayerId?: string;
};
```

```ts
// src/lib/player-view-shell.ts
import {
  isTrackedPlayerAlias,
  type TrackedResolutionSearch,
} from "~/lib/tracked-player-alias";

export function getPlayerViewHref(
  view: PlayerView,
  nickname: string,
  locked?: TrackedResolutionSearch
): PlayerViewHref {
  const resolvedPlayerId = locked?.resolvedPlayerId;

  if (view === "friends" && isTrackedPlayerAlias(nickname)) {
    return { to: "/tracked" };
  }

  switch (view) {
    case "history":
      return {
        to: "/history",
        search: {
          player: nickname,
          resolvedPlayerId,
          matches: 20,
          queue: "party",
        },
      };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/faceit-search.test.ts tests/lib/player-view-shell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracked-player-alias.ts src/lib/faceit-search.ts src/lib/player-view-shell.ts tests/lib/faceit-search.test.ts tests/lib/player-view-shell.test.ts
git commit -m "✨ feat(search): add tracked alias primitives"
```

### Task 2: Build The Server-Side Tracked Resolver

**Files:**
- Create: `src/server/tracked-player-alias.server.ts`
- Modify: `src/server/tracked-players.server.ts`
- Modify: `src/server/matches.ts`
- Create: `tests/server/tracked-player-alias.test.ts`
- Test: `tests/server/tracked-player-alias.test.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
// tests/server/tracked-player-alias.test.ts
it("returns null when there are no active tracked players", async () => {
  expect(
    await resolveTrackedPlayerForHistory({
      matches: 20,
      queue: "party",
    })
  ).toBeNull();
});

it("chooses the tracked player with the freshest qualifying history row", async () => {
  expect(
    await resolveTrackedPlayerForHistory({
      matches: 20,
      queue: "party",
    })
  ).toEqual({
    faceitId: "player-b",
    nickname: "PlayerB",
  });
});

it("prefers a currently live tracked player for the friends view", async () => {
  expect(await resolveTrackedPlayerForFriends()).toEqual({
    faceitId: "live-player",
    nickname: "LivePlayer",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/server/tracked-player-alias.test.ts`
Expected: FAIL because the resolver module does not exist.

- [ ] **Step 3: Implement focused page-aware resolvers**

```ts
// src/server/tracked-player-alias.server.ts
import { loadTrackedPlayersSnapshot } from "~/server/tracked-players.server";

type ResolvedTrackedPlayer = { faceitId: string; nickname: string };

function pickNewestCandidate<T extends ResolvedTrackedPlayer & {
  latestPlayedAt: string | null;
}>(candidates: T[]): ResolvedTrackedPlayer | null {
  const filtered = candidates.filter((candidate) => candidate.latestPlayedAt);
  if (filtered.length === 0) return null;
  filtered.sort((a, b) =>
    new Date(b.latestPlayedAt!).getTime() - new Date(a.latestPlayedAt!).getTime()
  );
  return {
    faceitId: filtered[0]!.faceitId,
    nickname: filtered[0]!.nickname,
  };
}

export async function resolveTrackedPlayerForHistory(input: {
  matches: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
}): Promise<{ faceitId: string; nickname: string } | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) return null;
  const candidates = await Promise.all(
    trackedPlayers.map(async (player) => ({
      ...player,
      latestPlayedAt: await findLatestHistoryPlayedAt({
        playerId: player.faceitId,
        n: input.matches,
        queue: input.queue,
      }),
    }))
  );
  return pickNewestCandidate(candidates);
}

export async function resolveTrackedPlayerForLeaderboard(input: {
  matches: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
  last: 30 | 90 | 180 | 365 | 730;
}): Promise<{ faceitId: string; nickname: string } | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) return null;
  const candidates = await Promise.all(
    trackedPlayers.map(async (player) => ({
      ...player,
      latestPlayedAt: await findLatestLeaderboardPlayedAt({
        targetPlayerId: player.faceitId,
        n: input.matches,
        days: input.last,
        queue: input.queue,
      }),
    }))
  );
  return pickNewestCandidate(candidates);
}

export async function resolveTrackedPlayerForLastParty(input: {
  date: string;
}): Promise<{ faceitId: string; nickname: string } | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) return null;
  const candidates = await Promise.all(
    trackedPlayers.map(async (player) => ({
      ...player,
      latestPlayedAt: await findLatestPartySessionPlayedAt({
        playerId: player.faceitId,
        date: input.date,
      }),
    }))
  );
  return pickNewestCandidate(candidates);
}

export async function resolveTrackedPlayerForFriends(): Promise<{
  faceitId: string;
  nickname: string;
} | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) return null;

  const liveCandidates = await findCurrentlyLiveTrackedPlayers(
    trackedPlayers.map((player) => player.faceitId)
  );
  if (liveCandidates.length > 0) {
    const livePlayer = trackedPlayers.find((player) =>
      liveCandidates.includes(player.faceitId)
    );
    return livePlayer
      ? { faceitId: livePlayer.faceitId, nickname: livePlayer.nickname }
      : null;
  }

  const candidates = await Promise.all(
    trackedPlayers.map(async (player) => ({
      ...player,
      latestPlayedAt: await findLatestRecentMatchPlayedAt(player.faceitId),
    }))
  );
  return pickNewestCandidate(candidates);
}
```

- [ ] **Step 4: Factor out tiny reusable selectors from matches server code if needed**

```ts
// src/server/matches.ts
export async function findLatestHistoryPlayedAt(input: {
  playerId: string;
  n: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
}): Promise<string | null> {
  // Query the same history basis already used by getPlayerStats and return
  // the newest qualifying played_at timestamp or null.
}

export async function findLatestLeaderboardPlayedAt(input: {
  targetPlayerId: string;
  n: 20 | 50 | 100;
  days: 30 | 90 | 180 | 365 | 730;
  queue: "all" | "solo" | "party";
}): Promise<string | null> {
  // Query the same target/recent leaderboard basis already used by getStatsLeaderboard
  // and return the newest qualifying played_at timestamp or null.
}

export async function findLatestPartySessionPlayedAt(input: {
  playerId: string;
  date: string;
}): Promise<string | null> {
  // Query the same match window already used by getPartySessionStats and return
  // the newest started_at timestamp within the qualifying party session or null.
}

export async function findLatestRecentMatchPlayedAt(
  playerId: string
): Promise<string | null> {
  // Query the latest available match for the player and return its played_at timestamp or null.
}

export async function findCurrentlyLiveTrackedPlayers(
  playerIds: string[]
): Promise<string[]> {
  // Reuse webhook/live-match state and return the subset of input player ids that are live.
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/server/tracked-player-alias.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/tracked-player-alias.server.ts src/server/tracked-players.server.ts src/server/matches.ts tests/server/tracked-player-alias.test.ts
git commit -m "✨ feat(server): add tracked player alias resolver"
```

### Task 3: Wire `/tracked` Friends View And Search Submission

**Files:**
- Create: `src/routes/_authed/tracked.tsx`
- Create: `src/components/player-dashboard/PlayerDashboardContent.tsx`
- Modify: `src/routes/_authed/$nickname.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `tests/components/app-layout.test.tsx`
- Create: `tests/routes/tracked-route.test.tsx`
- Test: `tests/routes/tracked-route.test.tsx`
- Test: `tests/components/app-layout.test.tsx`

- [ ] **Step 1: Write the failing `/tracked` route tests**

```tsx
// tests/routes/tracked-route.test.tsx
it("renders the friends view for the resolved tracked player", async () => {
  render(<TrackedRouteTestHarness />);
  expect(await screen.findByText(/Showing friends of/i)).toBeInTheDocument();
});

it("shows a tracked-specific empty state when no tracked player has recent activity", async () => {
  render(<TrackedRouteTestHarness />);
  expect(
    await screen.findByText("No tracked player has recent activity yet.")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/routes/tracked-route.test.tsx tests/components/app-layout.test.tsx`
Expected: FAIL because `/tracked` route and friends navigation support do not exist.

- [ ] **Step 3: Add `/tracked` route that resolves once, then renders existing friends page logic**

```tsx
// src/routes/_authed/tracked.tsx
export const Route = createFileRoute("/_authed/tracked")({
  component: TrackedDashboard,
});

function TrackedDashboard() {
  const { data: resolvedPlayer } = useQuery({
    queryKey: ["tracked-player", "friends"],
    queryFn: () => getTrackedFriendsTarget(),
  });

  if (!resolvedPlayer) {
    return <div>No tracked player has recent activity yet.</div>;
  }

  return (
    <PlayerDashboardContent
      inputValue="tracked"
      lockedResolvedPlayerId={resolvedPlayer.faceitId}
      sourcePlayerLabel="tracked"
    />
  );
}
```

```tsx
// src/components/player-dashboard/PlayerDashboardContent.tsx
export function PlayerDashboardContent(props: {
  inputValue: string;
  lockedResolvedPlayerId?: string | null;
  sourcePlayerLabel: string;
}) {
  const resolvedPlayerId = props.lockedResolvedPlayerId ?? null;
  const {
    data: searchResult,
    isLoading: searchLoading,
    isError: searchError,
  } = useQuery({
    queryKey: ["friends-search", props.sourcePlayerLabel, resolvedPlayerId],
    queryFn: () =>
      resolvedPlayerId
        ? searchAndLoadFriends({ data: resolvedPlayerId })
        : searchAndLoadFriends({ data: props.inputValue }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const friendIds = [
    ...(searchResult?.player.faceitId ? [searchResult.player.faceitId] : []),
    ...(searchResult?.friends.map((friend) => friend.faceitId) ?? []),
  ];

  const { data: liveMatches = [] } = useLiveMatches(friendIds);
  return <div>{searchLoading || searchError ? null : searchResult?.player.nickname}</div>;
}
```

- [ ] **Step 4: Update friends search submission and layout navigation**

```tsx
// src/routes/_authed/$nickname.tsx
if (isTrackedPlayerAlias(target.value)) {
  navigate({ to: "/tracked" });
  return;
}
```

```tsx
// src/components/AppLayout.tsx
if (pathname === "/tracked") {
  return "tracked";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/routes/tracked-route.test.tsx tests/components/app-layout.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authed/tracked.tsx src/routes/_authed/'$nickname.tsx' src/components/AppLayout.tsx tests/routes/tracked-route.test.tsx tests/components/app-layout.test.tsx
git commit -m "✨ feat(routes): add tracked friends route"
```

### Task 4: Wire `tracked` Into History, Leaderboard, And Last Party

**Files:**
- Modify: `src/routes/_authed/history.tsx`
- Modify: `src/routes/_authed/leaderboard.tsx`
- Modify: `src/routes/_authed/last-party.tsx`
- Modify: `src/lib/player-view-shell.ts`
- Modify: `tests/routes/last-party-route.test.tsx`
- Create: `tests/routes/history-route.test.tsx`
- Create: `tests/routes/leaderboard-route.test.tsx`
- Test: `tests/routes/history-route.test.tsx`
- Test: `tests/routes/leaderboard-route.test.tsx`
- Test: `tests/routes/last-party-route.test.tsx`

- [ ] **Step 1: Write the failing route tests for tracked alias resolution and empty states**

```tsx
// tests/routes/history-route.test.tsx
it("uses resolvedPlayerId when player=tracked is locked", async () => {
  render(<HistoryRouteHarness search="?player=tracked&resolvedPlayerId=player-123&matches=20&queue=party" />);
  expect(mockUsePlayerStats).toHaveBeenCalledWith("player-123", 20, "party");
});

it("shows a tracked-specific empty state when no tracked history candidate exists", async () => {
  render(<HistoryRouteHarness search="?player=tracked&matches=20&queue=party" />);
  expect(
    await screen.findByText("No tracked player has matching history for these filters.")
  ).toBeInTheDocument();
});
```

```tsx
// tests/routes/leaderboard-route.test.tsx
it("preserves filters when searching for tracked", async () => {
  render(<LeaderboardRouteHarness search="?player=tracked&matches=20&queue=party&last=30" />);
  expect(mockUseStatsLeaderboard).toHaveBeenCalledWith(
    expect.objectContaining({ n: 20, queue: "party", days: 30 })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/routes/history-route.test.tsx tests/routes/leaderboard-route.test.tsx tests/routes/last-party-route.test.tsx`
Expected: FAIL because the routes do not validate or consume `resolvedPlayerId`, and no tracked-specific empty states exist.

- [ ] **Step 3: Add route search params and tracked-aware resolution path**

```tsx
// src/routes/_authed/history.tsx
validateSearch: (search) => ({
  player: typeof search.player === "string" ? search.player : undefined,
  resolvedPlayerId:
    typeof search.resolvedPlayerId === "string" ? search.resolvedPlayerId : undefined,
  matches: normalizeHistoryMatchCount(search.matches),
  queue: normalizeHistoryQueueFilter(search.queue),
})

const trackedResolution = useQuery({
  queryKey: ["tracked-resolution", "history", selectedMatchCount, selectedQueue],
  queryFn: () =>
    resolveTrackedHistoryTarget({
      matches: selectedMatchCount,
      queue: selectedQueue,
    }),
  enabled: isTrackedPlayerAlias(urlPlayer) && !urlResolvedPlayerId,
});
```

- [ ] **Step 4: Keep the locked player stable across tab links**

```ts
// src/lib/player-view-shell.ts
getPlayerViewHref("leaderboard", "tracked", {
  resolvedPlayerId: currentResolvedPlayerId,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/routes/history-route.test.tsx tests/routes/leaderboard-route.test.tsx tests/routes/last-party-route.test.tsx tests/lib/player-view-shell.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authed/history.tsx src/routes/_authed/leaderboard.tsx src/routes/_authed/last-party.tsx src/lib/player-view-shell.ts tests/routes/history-route.test.tsx tests/routes/leaderboard-route.test.tsx tests/routes/last-party-route.test.tsx tests/lib/player-view-shell.test.ts
git commit -m "✨ feat(routes): resolve tracked alias across player views"
```

### Task 5: Final Regression Coverage And Verification

**Files:**
- Modify: `tests/lib/faceit-search.test.ts`
- Modify: `tests/components/app-layout.test.tsx`
- Modify: `tests/routes/tracked-route.test.tsx`
- Modify: `tests/routes/history-route.test.tsx`
- Modify: `tests/routes/leaderboard-route.test.tsx`
- Modify: `tests/routes/last-party-route.test.tsx`
- Test: `tests/lib/faceit-search.test.ts`
- Test: `tests/components/app-layout.test.tsx`
- Test: `tests/routes/tracked-route.test.tsx`
- Test: `tests/routes/history-route.test.tsx`
- Test: `tests/routes/leaderboard-route.test.tsx`
- Test: `tests/routes/last-party-route.test.tsx`

- [ ] **Step 1: Add regression tests for non-tracked flows**

```ts
// tests/lib/faceit-search.test.ts
it("keeps normal nicknames unchanged after tracked support", () => {
  expect(resolveFaceitSearchTarget("soavarice")).toEqual({
    kind: "player",
    value: "soavarice",
  });
});
```

```tsx
// tests/components/app-layout.test.tsx
it("keeps explicit player tabs unchanged when not browsing tracked", () => {
  expect(renderedHistoryLink).toContain("/history?player=soavarice");
});
```

- [ ] **Step 2: Run targeted route and unit tests**

Run:

```bash
pnpm vitest run \
  tests/lib/faceit-search.test.ts \
  tests/lib/player-view-shell.test.ts \
  tests/components/app-layout.test.tsx \
  tests/routes/tracked-route.test.tsx \
  tests/routes/history-route.test.tsx \
  tests/routes/leaderboard-route.test.tsx \
  tests/routes/last-party-route.test.tsx \
  tests/server/tracked-player-alias.test.ts
```

Expected: PASS

- [ ] **Step 3: Run full build verification**

Run: `pnpm build`
Expected: PASS with production bundle output and no import-protection failures.

- [ ] **Step 4: Commit**

```bash
git add tests/lib/faceit-search.test.ts tests/components/app-layout.test.tsx tests/routes/tracked-route.test.tsx tests/routes/history-route.test.tsx tests/routes/leaderboard-route.test.tsx tests/routes/last-party-route.test.tsx
git commit -m "✅ test(routes): cover tracked player alias flow"
```

## File Structure Summary

- `src/lib/tracked-player-alias.ts`
  Shared reserved-keyword helper and locked-resolution search metadata.
- `src/server/tracked-player-alias.server.ts`
  Central page-aware resolver for tracked alias selection.
- `src/routes/_authed/tracked.tsx`
  Friends-view entry route for `/tracked`.
- `src/routes/_authed/history.tsx`
  Tracked-aware history resolution and tracked-specific empty state.
- `src/routes/_authed/leaderboard.tsx`
  Tracked-aware leaderboard resolution and tracked-specific empty state.
- `src/routes/_authed/last-party.tsx`
  Tracked-aware last-party resolution and tracked-specific empty state.
- `src/lib/player-view-shell.ts`
  Stable tab links carrying `resolvedPlayerId`.
- `src/components/AppLayout.tsx`
  Recognize `/tracked` as a friends-style player flow.

## Verification Checklist

- `tracked` never falls through to FACEIT nickname lookup
- `/tracked` opens Friends view
- locked `resolvedPlayerId` survives tab navigation and refresh
- history, leaderboard, and last-party keep current filters while using `tracked`
- tracked-specific empty states render only when no active tracked player qualifies
- normal nickname, UUID, FACEIT URL, and match-id searches still behave as before
