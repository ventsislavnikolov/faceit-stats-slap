# Squad Match Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add party detection badges, post-match friend scoreboard with stats, and playful banter to LiveMatchCard.

**Architecture:** Modify `getLiveMatches` to retain recently-finished matches (30-min window). When a match finishes, `LiveMatchCard` switches layout to show a friends-only scoreboard fetched via `getMatchDetails`. Banter lines use hardcoded templates with deterministic random selection per match.

**Tech Stack:** React 19, TanStack Start/Query, Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-squad-match-experience-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/banter.ts` | Create | Banter template arrays + `getBanterLine(type, name, matchId)` |
| `src/lib/banter.test.ts` | Create | Tests for banter selection, determinism, template validity |
| `src/hooks/useMatchStats.ts` | Create | Hook wrapping `getMatchDetails` for finished matches |
| `src/components/PostMatchScoreboard.tsx` | Create | Scoreboard table, multi-kill badges, banter display |
| `src/server/matches.ts` | Modify | Include FINISHED matches within 30 min in `getLiveMatches` |
| `src/components/LiveMatchCard.tsx` | Modify | Party badge, status branching for post-match layout |

---

### Task 1: Banter Template System

**Files:**
- Create: `src/lib/banter.ts`
- Create: `src/lib/banter.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/lib/banter.test.ts
import { describe, it, expect } from "vitest";
import { getBanterLine } from "./banter";

describe("getBanterLine", () => {
  it("returns a carry line containing the player name", () => {
    const line = getBanterLine("carry", "F1aw1esss", "match-123");
    expect(line).toContain("F1aw1esss");
  });

  it("returns a roast line containing the player name", () => {
    const line = getBanterLine("roast", "eLfen0men0", "match-456");
    expect(line).toContain("eLfen0men0");
  });

  it("is deterministic for the same matchId", () => {
    const a = getBanterLine("carry", "Test", "match-abc");
    const b = getBanterLine("carry", "Test", "match-abc");
    expect(a).toBe(b);
  });

  it("produces different lines for different matchIds", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(getBanterLine("carry", "X", `match-${i}`));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/banter.test.ts`
Expected: FAIL — `getBanterLine` not found

- [ ] **Step 3: Implement banter.ts**

```typescript
// src/lib/banter.ts
type BanterType = "carry" | "roast";

const CARRY_LINES = [
  "{name} carried harder than a shopping bag",
  "{name} turned the server into a highlight reel",
  "The other team is still looking for {name}",
  "{name} chose violence today",
  "Rename the match to the {name} show",
  "{name} made the whole lobby question their rank",
  "{name} just put that on the resume",
  "{name} was playing a different game than everyone else",
  "Someone check {name}'s gaming chair",
  "{name} went full action movie protagonist",
  "{name} didn't come to play, they came to dominate",
  "The server should thank {name} for the content",
  "{name} treated the match like aim practice",
  "{name} woke up and chose destruction",
  "{name} had the lobby on speed dial",
];

const ROAST_LINES = [
  "{name} was the team's emotional support",
  "{name} brought good vibes instead of aim",
  "{name} was just there for the company",
  "At least {name} had fun... right?",
  "{name} played like their monitor was off",
  "{name} contributed moral support",
  "{name} was busy admiring the map design",
  "{name} brought snacks instead of frags",
  "{name} was lagging in spirit",
  "{name} had a nice workout pressing W",
  "{name} was sightseeing on the map",
  "{name} mistook this for a walking simulator",
  "{name} was providing valuable intel... to the enemy",
  "{name} was playing on a steering wheel",
  "{name} was in the lobby for warmth",
];

function hashMatchId(matchId: string): number {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = (hash * 31 + matchId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getBanterLine(
  type: BanterType,
  name: string,
  matchId: string
): string {
  const lines = type === "carry" ? CARRY_LINES : ROAST_LINES;
  const index = hashMatchId(matchId + type) % lines.length;
  return lines[index].replace("{name}", name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/banter.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/banter.ts src/lib/banter.test.ts
git commit -m "feat: add banter template system for post-match scoreboard"
```

---

### Task 2: Retain Finished Matches in getLiveMatches

**Files:**
- Modify: `src/server/matches.ts` (lines 47-54)

- [ ] **Step 1: Modify the status filter in getLiveMatches**

In `src/server/matches.ts`, replace the match filtering logic (lines 47-54):

```typescript
// Before:
const matchResults = await Promise.allSettled(
  [...uniqueMatches.entries()].map(async ([matchId]) => {
    const match = await fetchMatch(matchId);
    const activeStatuses = ["ONGOING", "READY", "VOTING", "CONFIGURING"];
    if (!activeStatuses.includes(match.status)) return null;
    return { match, friendIds: uniqueMatches.get(matchId)! };
  })
);

// After:
const THIRTY_MINUTES = 30 * 60;
const matchResults = await Promise.allSettled(
  [...uniqueMatches.entries()].map(async ([matchId]) => {
    const match = await fetchMatch(matchId);
    const activeStatuses = ["ONGOING", "READY", "VOTING", "CONFIGURING"];
    if (activeStatuses.includes(match.status)) {
      return { match, friendIds: uniqueMatches.get(matchId)! };
    }
    if (match.status === "FINISHED" && match.finished_at) {
      const age = Math.floor(Date.now() / 1000) - match.finished_at;
      if (age <= THIRTY_MINUTES) {
        return { match, friendIds: uniqueMatches.get(matchId)! };
      }
    }
    return null;
  })
);
```

- [ ] **Step 2: Exclude finished matches from betting pool sweep**

The stale pool sweep (lines 136-164) uses `liveIds` to skip pools for active matches. With FINISHED matches now in the live list, their pools would be skipped and never resolved. Fix by excluding FINISHED matches from `liveIds`:

```typescript
// Before (line 137):
const liveIds = liveMatches.map((m) => m.matchId);

// After:
const liveIds = liveMatches
  .filter((m) => m.status !== "FINISHED")
  .map((m) => m.matchId);
```

This ensures FINISHED matches still get their betting pools resolved immediately by the sweep, while keeping them visible in the UI.

- [ ] **Step 3: Verify the app still builds**

Run: `pnpm build`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat: retain recently-finished matches in live feed (30-min window)"
```

---

### Task 3: useMatchStats Hook

**Files:**
- Create: `src/hooks/useMatchStats.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useMatchStats.ts
import { useQuery } from "@tanstack/react-query";
import { getMatchDetails } from "~/server/matches";

export function useMatchStats(matchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: () => getMatchDetails({ data: matchId }),
    enabled,
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMatchStats.ts
git commit -m "feat: add useMatchStats hook for finished match stats"
```

---

### Task 4: PostMatchScoreboard Component

**Files:**
- Create: `src/components/PostMatchScoreboard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/PostMatchScoreboard.tsx
import type { MatchPlayerStats } from "~/lib/types";
import { getBanterLine } from "~/lib/banter";

interface PostMatchScoreboardProps {
  matchId: string;
  friendIds: string[];
  players: MatchPlayerStats[];
}

export function PostMatchScoreboard({
  matchId,
  friendIds,
  players,
}: PostMatchScoreboardProps) {
  const friendSet = new Set(friendIds);
  const friendStats = players
    .filter((p) => friendSet.has(p.playerId))
    .sort((a, b) => b.kills - a.kills);

  if (friendStats.length === 0) return null;

  const topFragger = friendStats[0];
  const bottomFragger = friendStats[friendStats.length - 1];
  const showBanter = friendStats.length >= 2;

  const multiKills = friendStats.filter(
    (p) => p.tripleKills > 0 || p.quadroKills > 0 || p.pentaKills > 0
  );

  return (
    <div className="border-t border-border mt-3 pt-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">
        Your Squad
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 text-[9px] text-text-dim mb-1 px-1">
        <span />
        <span />
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
        <span className="text-center">HS%</span>
        <span className="text-center">MVP</span>
      </div>

      {/* Player rows */}
      {friendStats.map((player, i) => {
        const isTop = i === 0;
        const isBottom = i === friendStats.length - 1 && friendStats.length > 1;

        let rowBg = "";
        let nameColor = "text-text";
        let statsColor = "text-text";
        let rankDisplay: React.ReactNode = (
          <span className="text-text-dim text-[10px] text-center">
            {i + 1}
          </span>
        );

        if (isTop) {
          rowBg = "bg-accent/8";
          nameColor = "text-accent font-semibold";
          rankDisplay = <span className="text-sm">&#x1F451;</span>;
        } else if (isBottom) {
          rowBg = "bg-error/5";
          nameColor = "text-text-muted";
          statsColor = "text-text-muted";
          rankDisplay = <span className="text-xs">&#x1F480;</span>;
        }

        return (
          <div
            key={player.playerId}
            className={`grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 text-[11px] px-1 py-1.5 rounded ${rowBg} mb-0.5 items-center`}
          >
            {rankDisplay}
            <span className={nameColor}>{player.nickname}</span>
            <span className={`text-center ${isTop ? "font-bold text-text" : statsColor}`}>
              {player.kills}
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.deaths}
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.assists}
            </span>
            <span
              className={`text-center font-bold ${
                player.kdRatio >= 1 ? "text-accent" : "text-error/70"
              }`}
            >
              {player.kdRatio.toFixed(2)}
            </span>
            <span className={`text-center ${statsColor}`}>
              {Math.round(player.adr)}
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.hsPercent}%
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.mvps}
            </span>
          </div>
        );
      })}

      {/* Multi-kill badges */}
      {multiKills.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {multiKills.map((p) => {
            const parts: string[] = [];
            if (p.tripleKills > 0) parts.push(`${p.tripleKills}x Triple`);
            if (p.quadroKills > 0) parts.push(`${p.quadroKills}x Quadro`);
            if (p.pentaKills > 0) parts.push(`${p.pentaKills}x Penta`);
            return (
              <span
                key={p.playerId}
                className="bg-accent/10 text-accent text-[9px] px-1.5 py-0.5 rounded"
              >
                {p.nickname}: {parts.join(", ")}
              </span>
            );
          })}
        </div>
      )}

      {/* Banter */}
      {showBanter && (
        <div className="border-t border-border mt-3 pt-2.5 text-center">
          <span className="text-text-muted text-[11px] italic">
            {getBanterLine("carry", topFragger.nickname, matchId)}
            {". "}
            {getBanterLine("roast", bottomFragger.nickname, matchId)}
            {"."}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/PostMatchScoreboard.tsx
git commit -m "feat: add PostMatchScoreboard component"
```

---

### Task 5: Update LiveMatchCard with Party Badge + Post-Match Layout

**Files:**
- Modify: `src/components/LiveMatchCard.tsx`

- [ ] **Step 1: Rewrite LiveMatchCard**

Replace the entire content of `src/components/LiveMatchCard.tsx`:

```tsx
// src/components/LiveMatchCard.tsx
import type { LiveMatch } from "~/lib/types";
import { MapBadge } from "./MapBadge";
import { useBettingPool } from "~/hooks/useBettingPool";
import { BettingPanel } from "~/components/BettingPanel";
import { useMatchStats } from "~/hooks/useMatchStats";
import { PostMatchScoreboard } from "./PostMatchScoreboard";

interface LiveMatchCardProps {
  match: LiveMatch;
  userId?: string | null;
  userCoins?: number;
}

export function LiveMatchCard({ match, userId, userCoins }: LiveMatchCardProps) {
  const { data: betData } = useBettingPool(match.matchId, userId ?? null);
  const isFinished = match.status === "FINISHED";
  const { data: matchStats } = useMatchStats(match.matchId, isFinished);

  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const isFriendFaction1 = match.friendFaction === "faction1";
  const showPartyBadge = match.friendIds.length >= 3;

  const friendWon = matchStats?.players.some(
    (p) => match.friendIds.includes(p.playerId) && p.result
  );

  const borderColor = isFinished
    ? "border-border"
    : "border-accent/20";
  const gradientFrom = isFinished
    ? "from-bg-elevated/50"
    : "from-accent/5";

  return (
    <div className={`bg-gradient-to-br ${gradientFrom} to-bg-card border ${borderColor} rounded-lg p-4 mb-4`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="text-text-muted text-xs font-bold">FINISHED</span>
          ) : (
            <span className="flex items-center gap-1 text-error text-xs">
              <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
              LIVE
            </span>
          )}
          <MapBadge map={match.map} />
          {showPartyBadge && (
            <span className="bg-accent/15 text-accent text-[10px] px-2 py-0.5 rounded font-semibold">
              Party ({match.friendIds.length})
            </span>
          )}
        </div>
        {isFinished && matchStats ? (
          <span className={`text-xs font-bold ${friendWon ? "text-accent" : "text-error"}`}>
            {friendWon ? "WIN" : "LOSS"}
          </span>
        ) : (
          <span className="text-text-muted text-xs">{match.status}</span>
        )}
      </div>

      {/* Score */}
      {isFinished ? (
        <div className="flex justify-center items-center gap-4 mb-1">
          <span className={`text-sm ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f1.name}
          </span>
          <span className={`text-2xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction1}
          </span>
          <span className="text-text-dim text-sm">-</span>
          <span className={`text-2xl font-bold ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction2}
          </span>
          <span className={`text-sm ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f2.name}
          </span>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-center gap-6 mb-3">
            <div className="text-center">
              <div className={`text-sm mb-1 ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {f1.name}
              </div>
              <div className={`text-3xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {match.score.faction1}
              </div>
            </div>
            <div className="text-text-dim text-lg">vs</div>
            <div className="text-center">
              <div className={`text-sm mb-1 ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {f2.name}
              </div>
              <div className={`text-3xl font-bold ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {match.score.faction2}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-1.5">
            {match.friendIds.map((id) => {
              const roster = [...f1.roster, ...f2.roster];
              const player = roster.find((p) => p.playerId === id);
              return (
                <span key={id} className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded">
                  {player?.nickname || id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Post-match scoreboard */}
      {isFinished && matchStats && (
        <PostMatchScoreboard
          matchId={match.matchId}
          friendIds={match.friendIds}
          players={matchStats.players}
        />
      )}

      {/* Betting panel */}
      {betData?.pool && (
        <BettingPanel
          pool={betData.pool}
          userBet={betData.userBet}
          userId={userId ?? null}
          userCoins={userCoins ?? 0}
          matchId={match.matchId}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify app builds**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass (banter tests from Task 1)

- [ ] **Step 4: Commit**

```bash
git add src/components/LiveMatchCard.tsx
git commit -m "feat: add party badge and post-match scoreboard to LiveMatchCard"
```

---

### Task 6: Manual Verification

- [ ] **Step 1: Start dev server and verify live card**

Run: `pnpm dev`

Open the app, search for a player with friends. Verify:
- Live match cards still work as before
- Party badge appears when 3+ friends are in same match
- If any friend has a recently-finished match, the post-match card should appear with scoreboard and banter

- [ ] **Step 2: Verify with a known finished match**

If no matches are currently live/recently finished, temporarily lower the `THIRTY_MINUTES` constant in `src/server/matches.ts` to a larger value (e.g. `24 * 60 * 60` for 24 hours) to test with older finished matches. Remember to revert after testing.

- [ ] **Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: adjust post-match scoreboard after manual testing"
```
