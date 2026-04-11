# Boneyard Skeleton Migration

**Date:** 2026-04-11
**Status:** Approved

## Problem

~400 lines of hand-crafted `animate-pulse` divs are scattered across 4 route files and 1 component. They are manually sized guesses at real component layouts and drift silently as the UI evolves.

## Solution

Replace all hand-crafted skeleton divs with `boneyard-js` (`<Skeleton>` wrappers). Boneyard captures real component layouts via a headless browser (Vite plugin) and renders pixel-perfect skeletons automatically. When the UI changes, re-running the dev server updates the bones — no manual skeleton maintenance.

## Approach: Component-owns-its-skeleton

Each component that has a loading state wraps its real content with `<Skeleton name="[unique-name]" loading={loading}>`. Routes pass loading flags as props instead of conditionally rendering hand-crafted divs.

## Installation

```bash
pnpm add boneyard-js
```

## Configuration

**`boneyard.config.json`** (project root):
```json
{
  "breakpoints": [375, 768, 1280],
  "out": "./src/bones",
  "animate": "pulse"
}
```

**`vite.config.ts`** — add the plugin:
```ts
import { boneyardPlugin } from 'boneyard-js/vite'
// add to plugins array
boneyardPlugin()
```

**`.bones.json` files** are generated under `./src/bones/` on first dev run and committed to source control so CI/prod builds are self-contained.

## Skeleton Boundaries

One `<Skeleton>` per semantic section:

| Skeleton name | File | Loading source |
|---|---|---|
| `season-leaderboard` | `SeasonLeaderboardTab.tsx` | internal `isLoading` + `loading` prop |
| `friends-sidebar` | `FriendsSidebar.tsx` | `loading` prop from `$nickname.tsx` |
| `friends-main` | `$nickname.tsx` (inline) | `searchLoading` |
| `friends-stats` | `$nickname.tsx` (inline) | `statsLoading` |
| `bets-header` | `bets.tsx` (inline) | `!authResolved \|\| seasonLoading` |
| `bets-leaderboard` | `bets.tsx` (delegates to `SeasonLeaderboardTab`) | same gate |
| `last-party-body` | `last-party.tsx` (inline) | `resolving \|\| sessionLoading` |
| `match-detail` | `match.$matchId.tsx` (inline) | `isLoading` |

## Component Changes

### `FriendsSidebar`
- Add `loading?: boolean` prop
- Wrap return with `<Skeleton name="friends-sidebar" loading={loading ?? false}>`
- Remove nothing from `FriendsSidebar` internals (it has no current skeleton)

### `SeasonLeaderboardTab`
- Add `loading?: boolean` prop
- Wrap real content with `<Skeleton name="season-leaderboard" loading={isLoading || (loading ?? false)}>`
- Delete existing `if (isLoading) return <big div>` block

### Route files (`$nickname.tsx`, `bets.tsx`, `last-party.tsx`, `match.$matchId.tsx`)
- Delete each `loading ? <hand-crafted-divs> : <real-content>` conditional
- Render real content unconditionally, wrapped in appropriately named `<Skeleton>` components
- Pass `loading` prop into `FriendsSidebar` and `SeasonLeaderboardTab` where applicable

## Test IDs

`last-party-route.test.tsx` references:
- `data-testid="last-party-podium-skeleton"`
- `data-testid="last-party-rivalry-skeleton"`

These currently live on hand-crafted divs. Move them to the corresponding `<Skeleton>` wrapper elements (boneyard forwards unknown props to its container). Tests require no other changes.

## Error Handling

No change. All `isError`, empty-state, and not-found branches remain untouched — boneyard only intercepts the `loading=true` path.

## Transition

Leave `transition` prop off (default). Matches the current abrupt skeleton-to-content swap. Can be enabled later per component if desired.

## Bones Capture Workflow

After adding any new `<Skeleton name="...">`, run `pnpm dev` once — the Vite plugin visits the app headlessly and generates/updates the corresponding `.bones.json` file. Commit the updated file alongside the code change.

## Scope

- No logic changes — pure structural swap
- No new tests required
- All existing tests must pass after moving `data-testid` attributes
