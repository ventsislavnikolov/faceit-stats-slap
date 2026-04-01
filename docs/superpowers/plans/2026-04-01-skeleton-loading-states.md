# Skeleton Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all text-based "Loading..." messages with pulsing skeleton UIs that match each page's loaded content layout.

**Architecture:** Each loading state gets inline skeleton JSX using `animate-pulse` + `rounded bg-bg-elevated` blocks sized to match the real content. No shared component — skeletons live next to their data counterparts.

**Tech Stack:** React JSX, Tailwind CSS (`animate-pulse`, `bg-bg-elevated`, `rounded`)

---

### Task 1: Leaderboard Page Skeleton

**Files:**
- Modify: `src/routes/_authed/leaderboard.tsx`

- [ ] **Step 1: Replace the two "Loading..." states with a skeleton table**

In `src/routes/_authed/leaderboard.tsx`, find the two loading blocks (resolving target and loading stats) that render:
```jsx
<div className="animate-pulse py-8 text-center text-accent">
  Loading...
</div>
```

Replace BOTH with the same skeleton. The leaderboard uses grid template `3rem 1fr 4rem repeat(7, 5rem)` (7 cols for combat tab default). Render 5 skeleton rows:

```jsx
<div className="flex flex-col gap-1">
  {Array.from({ length: 5 }).map((_, i) => (
    <div
      className="grid items-center gap-2 rounded bg-bg-elevated px-3 py-2"
      key={i}
      style={{ gridTemplateColumns: "3rem 1fr 4rem repeat(7, 5rem)" }}
    >
      <div className="h-3 w-6 animate-pulse rounded bg-border" />
      <div className="flex items-baseline gap-1.5">
        <div className="h-3 w-24 animate-pulse rounded bg-border" />
        <div className="h-2 w-8 animate-pulse rounded bg-border" />
      </div>
      <div className="ml-auto h-3 w-6 animate-pulse rounded bg-border" />
      {Array.from({ length: 7 }).map((_, j) => (
        <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" key={j} />
      ))}
    </div>
  ))}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authed/leaderboard.tsx
git commit -m "fix: replace leaderboard loading text with skeleton UI"
```

---

### Task 2: History Page Skeleton

**Files:**
- Modify: `src/routes/_authed/history.tsx`

- [ ] **Step 1: Replace loading state with skeleton match rows**

In `src/routes/_authed/history.tsx`, find the loading block that renders `"Loading..."`. The HistoryMatchesTable uses grid template `"3rem 24rem 2.5rem repeat(7, 5rem)"`. Replace with 8 skeleton rows:

```jsx
<div className="flex flex-col gap-1">
  {Array.from({ length: 8 }).map((_, i) => (
    <div
      className="grid min-w-[50rem] gap-2 rounded border-l-2 border-border bg-bg-elevated px-3 py-2"
      key={i}
      style={{ gridTemplateColumns: "3rem 24rem 2.5rem repeat(7, 5rem)" }}
    >
      <div className="h-3 w-8 animate-pulse rounded bg-border" />
      <div className="h-3 w-20 animate-pulse rounded bg-border" />
      <div className="mx-auto h-3 w-3 animate-pulse rounded bg-border" />
      {Array.from({ length: 7 }).map((_, j) => (
        <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" key={j} />
      ))}
    </div>
  ))}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authed/history.tsx
git commit -m "fix: replace history loading text with skeleton UI"
```

---

### Task 3: Last Party Page Skeleton

**Files:**
- Modify: `src/routes/_authed/last-party.tsx`

- [ ] **Step 1: Replace "Loading party session..." with skeleton**

In `src/routes/_authed/last-party.tsx`, find the loading block that renders `"Loading party session..."`. The loaded UI has: a header summary row, then a SessionStatsTable (HTML table with ~8 columns), then map distribution. Replace with:

```jsx
<div className="flex flex-col gap-6">
  {/* Header summary skeleton */}
  <div className="flex items-center gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <div className="flex flex-col gap-1" key={i}>
        <div className="h-2 w-12 animate-pulse rounded bg-border" />
        <div className="h-4 w-16 animate-pulse rounded bg-border" />
      </div>
    ))}
  </div>
  {/* Stats table skeleton */}
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr>
          {Array.from({ length: 8 }).map((_, i) => (
            <th className="px-2 py-1" key={i}>
              <div className="mx-auto h-2 w-8 animate-pulse rounded bg-border" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <tr className="border-border border-t" key={i}>
            {Array.from({ length: 8 }).map((_, j) => (
              <td className="px-2 py-1.5" key={j}>
                <div className={`mx-auto h-3 animate-pulse rounded bg-border ${j === 0 ? "w-16" : "w-8"}`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  {/* Map distribution skeleton */}
  <div className="h-8 w-full animate-pulse rounded bg-bg-elevated" />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authed/last-party.tsx
git commit -m "fix: replace last party loading text with skeleton UI"
```

---

### Task 4: Friends / Live Party Page Skeleton

**Files:**
- Modify: `src/routes/_authed/$nickname.tsx`

- [ ] **Step 1: Replace "Loading friends for..." with skeleton layout**

In `src/routes/_authed/$nickname.tsx`, find the loading block that renders `"Loading friends for {nickname} (up to 100)..."`. The loaded UI is a two-column layout: left sidebar (260px) with friend cards, right area with match rows. Replace with:

```jsx
<div className="flex h-full">
  {/* Sidebar skeleton */}
  <div className="hidden h-full w-[260px] flex-shrink-0 border-border border-r bg-bg-card p-3 lg:block">
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="rounded-lg border border-transparent bg-bg-elevated p-2.5" key={i}>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-border" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="h-3 w-20 animate-pulse rounded bg-border" />
              <div className="h-2 w-16 animate-pulse rounded bg-border" />
            </div>
          </div>
          <div className="mb-1.5 grid grid-cols-2 gap-1">
            {Array.from({ length: 4 }).map((_, j) => (
              <div className="h-3 animate-pulse rounded bg-border" key={j} />
            ))}
          </div>
          <div className="h-1.5 w-full animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  </div>
  {/* Main content skeleton */}
  <div className="flex-1 p-4">
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          className="flex items-center rounded border-l-[3px] border-border bg-bg-card px-2.5 py-2"
          key={i}
        >
          <div className="h-3 w-4 animate-pulse rounded bg-border" />
          <div className="ml-2 h-3 w-20 animate-pulse rounded bg-border" />
          <div className="ml-2 h-3 w-16 animate-pulse rounded bg-border" />
          <div className="ml-2 h-3 w-12 animate-pulse rounded bg-border" />
          <div className="ml-2 h-3 w-32 animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Replace "Loading match history..." with skeleton rows**

In the same file, find the loading block that renders `"Loading match history..."`. Replace with:

```jsx
<div className="flex flex-col gap-2">
  {Array.from({ length: 5 }).map((_, i) => (
    <div
      className="flex items-center rounded border-l-[3px] border-border bg-bg-card px-2.5 py-2"
      key={i}
    >
      <div className="h-3 w-4 animate-pulse rounded bg-border" />
      <div className="ml-2 h-3 w-20 animate-pulse rounded bg-border" />
      <div className="ml-2 h-3 w-16 animate-pulse rounded bg-border" />
      <div className="ml-2 h-3 w-12 animate-pulse rounded bg-border" />
      <div className="ml-2 h-3 w-32 animate-pulse rounded bg-border" />
    </div>
  ))}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authed/\$nickname.tsx
git commit -m "fix: replace friends page loading text with skeleton UI"
```

---

### Task 5: Match Detail Page Skeleton

**Files:**
- Modify: `src/routes/_authed/match.$matchId.tsx`

- [ ] **Step 1: Replace "Loading match..." with skeleton layout**

In `src/routes/_authed/match.$matchId.tsx`, find the loading block that renders `"Loading match..."`. The loaded UI has: a header card (status + map + team scores), then a scoreboard. Replace with:

```jsx
<div className="mx-auto max-w-6xl p-4">
  {/* Header skeleton */}
  <div className="mb-4 rounded-lg border border-border p-4">
    <div className="mb-3 flex items-center gap-2">
      <div className="h-4 w-16 animate-pulse rounded bg-border" />
      <div className="h-4 w-20 animate-pulse rounded bg-border" />
    </div>
    {/* Score skeleton */}
    <div className="mb-3 flex items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <div className="h-3 w-20 animate-pulse rounded bg-border" />
        <div className="h-8 w-8 animate-pulse rounded bg-border" />
      </div>
      <div className="h-4 w-4 animate-pulse rounded bg-border" />
      <div className="flex flex-col items-center gap-1">
        <div className="h-3 w-20 animate-pulse rounded bg-border" />
        <div className="h-8 w-8 animate-pulse rounded bg-border" />
      </div>
    </div>
  </div>
  {/* Scoreboard skeleton */}
  <div className="flex flex-col gap-1">
    {Array.from({ length: 10 }).map((_, i) => (
      <div className="flex items-center gap-3 rounded bg-bg-elevated px-3 py-2" key={i}>
        <div className="h-3 w-20 animate-pulse rounded bg-border" />
        <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
        <div className="h-3 w-8 animate-pulse rounded bg-border" />
        <div className="h-3 w-8 animate-pulse rounded bg-border" />
        <div className="h-3 w-10 animate-pulse rounded bg-border" />
        <div className="h-3 w-8 animate-pulse rounded bg-border" />
        <div className="h-3 w-8 animate-pulse rounded bg-border" />
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authed/match.\$matchId.tsx
git commit -m "fix: replace match detail loading text with skeleton UI"
```

---

### Task 6: Bets Page & Tab Skeletons

**Files:**
- Modify: `src/routes/_authed/bets.tsx`
- Modify: `src/components/SeasonLeaderboardTab.tsx`
- Modify: `src/components/SeasonMyBetsTab.tsx`
- Modify: `src/components/SeasonHistoryTab.tsx`

- [ ] **Step 1: Replace bets page auth/season loading with skeleton**

In `src/routes/_authed/bets.tsx`, find the loading block that renders `"Loading..."` for `!authResolved || seasonLoading`. Replace with a skeleton that mimics the season header + tab bar + leaderboard rows:

```jsx
<div className="flex flex-1 flex-col overflow-hidden">
  <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      {/* Season header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-32 animate-pulse rounded bg-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-border" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded bg-border" />
      </div>
      {/* Tab bar skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="h-8 w-24 animate-pulse rounded bg-bg-elevated" key={i} />
        ))}
      </div>
      {/* Leaderboard rows skeleton */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
            key={i}
            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
          >
            <div className="h-3 w-6 animate-pulse rounded bg-border" />
            <div className="h-3 w-24 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Replace SeasonLeaderboardTab loading with skeleton**

In `src/components/SeasonLeaderboardTab.tsx`, find the loading block. Grid template is `"3rem 1fr 5rem 5rem 5rem"`. Replace with:

```jsx
<div className="flex flex-col gap-1">
  {Array.from({ length: 5 }).map((_, i) => (
    <div
      className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
      key={i}
      style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
    >
      <div className="h-3 w-6 animate-pulse rounded bg-border" />
      <div className="h-3 w-24 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
    </div>
  ))}
</div>
```

- [ ] **Step 3: Replace SeasonMyBetsTab loading with skeleton**

In `src/components/SeasonMyBetsTab.tsx`, find the loading block. Grid template is `"1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr"`. Replace with:

```jsx
<div className="flex flex-col gap-1">
  {Array.from({ length: 4 }).map((_, i) => (
    <div
      className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
      key={i}
      style={{ gridTemplateColumns: "1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr" }}
    >
      <div className="h-3 w-28 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-16 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
      <div className="ml-auto h-3 w-12 animate-pulse rounded bg-border" />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Replace SeasonHistoryTab loading with skeleton**

In `src/components/SeasonHistoryTab.tsx`, find the loading block. Replace with:

```jsx
<div className="flex flex-col gap-4">
  <div className="flex gap-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div className="h-8 w-28 animate-pulse rounded bg-bg-elevated" key={i} />
    ))}
  </div>
  <div className="flex flex-col gap-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
        key={i}
        style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
      >
        <div className="h-3 w-6 animate-pulse rounded bg-border" />
        <div className="h-3 w-24 animate-pulse rounded bg-border" />
        <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" />
        <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
        <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authed/bets.tsx src/components/SeasonLeaderboardTab.tsx src/components/SeasonMyBetsTab.tsx src/components/SeasonHistoryTab.tsx
git commit -m "fix: replace bets page loading text with skeleton UI"
```

---

### Task 7: Home Live Matches Skeleton

**Files:**
- Modify: `src/components/HomeLiveMatchesSection.tsx`

- [ ] **Step 1: Replace "Loading live matches..." with skeleton cards**

In `src/components/HomeLiveMatchesSection.tsx`, find the loading block. The loaded UI renders LiveMatchCard components. Replace with 2 skeleton match cards:

```jsx
<div className="flex flex-col gap-4">
  {Array.from({ length: 2 }).map((_, i) => (
    <div className="rounded-lg border border-border bg-bg-card p-4" key={i}>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-10 animate-pulse rounded bg-border" />
        <div className="h-4 w-20 animate-pulse rounded bg-border" />
      </div>
      <div className="mb-3 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="h-3 w-20 animate-pulse rounded bg-border" />
          <div className="h-8 w-8 animate-pulse rounded bg-border" />
        </div>
        <div className="text-lg text-text-dim">vs</div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-3 w-20 animate-pulse rounded bg-border" />
          <div className="h-8 w-8 animate-pulse rounded bg-border" />
        </div>
      </div>
      <div className="border-border border-t pt-3">
        <div className="mb-2 flex justify-between">
          <div className="h-2 w-16 animate-pulse rounded bg-border" />
          <div className="h-2 w-20 animate-pulse rounded bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded bg-bg-elevated" />
          <div className="h-10 animate-pulse rounded bg-bg-elevated" />
        </div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HomeLiveMatchesSection.tsx
git commit -m "fix: replace home live matches loading text with skeleton UI"
```
