import { describe, expect, it } from "vitest";
import {
  buildStatsLeaderboardSyncKey,
  buildStatsLeaderboardSyncPlayerIds,
  shouldAutoSyncStatsLeaderboard,
} from "~/lib/stats-leaderboard-sync";

describe("stats leaderboard auto-sync policy", () => {
  it("auto-syncs when a searchable leaderboard target has friends and this scope was not synced yet", () => {
    const attemptedKeys = new Set<string>();
    const key = buildStatsLeaderboardSyncKey({
      targetPlayerId: "target",
      playerIds: ["friend-b", "friend-a"],
      n: 20,
      days: 730,
    });

    expect(
      shouldAutoSyncStatsLeaderboard({
        targetPlayerId: "target",
        playerIds: ["friend-a", "friend-b"],
        n: 20,
        days: 730,
        isPending: false,
        attemptedKeys,
      })
    ).toBe(true);
    expect(key).toBe("target|friend-a,friend-b|20|730");
  });

  it("does not auto-sync when the same scope was already attempted", () => {
    const attemptedKeys = new Set(["target|friend-a|20|730"]);

    expect(
      shouldAutoSyncStatsLeaderboard({
        targetPlayerId: "target",
        playerIds: ["friend-a"],
        n: 20,
        days: 730,
        isPending: false,
        attemptedKeys,
      })
    ).toBe(false);
  });

  it("does not auto-sync without a target, without friends, or while a sync is pending", () => {
    expect(
      shouldAutoSyncStatsLeaderboard({
        targetPlayerId: "",
        playerIds: ["friend-a"],
        n: 20,
        days: 730,
        isPending: false,
        attemptedKeys: new Set(),
      })
    ).toBe(false);

    expect(
      shouldAutoSyncStatsLeaderboard({
        targetPlayerId: "target",
        playerIds: [],
        n: 20,
        days: 730,
        isPending: false,
        attemptedKeys: new Set(),
      })
    ).toBe(false);

    expect(
      shouldAutoSyncStatsLeaderboard({
        targetPlayerId: "target",
        playerIds: ["friend-a"],
        n: 20,
        days: 730,
        isPending: true,
        attemptedKeys: new Set(),
      })
    ).toBe(false);
  });

  it("auto-sync only backfills the searched player history", () => {
    expect(
      buildStatsLeaderboardSyncPlayerIds({
        mode: "auto",
        playerIds: ["friend-a", "friend-b"],
      })
    ).toEqual([]);
  });

  it("manual sync keeps the full friend scope", () => {
    expect(
      buildStatsLeaderboardSyncPlayerIds({
        mode: "manual",
        playerIds: ["friend-a", "friend-b"],
      })
    ).toEqual(["friend-a", "friend-b"]);
  });
});
