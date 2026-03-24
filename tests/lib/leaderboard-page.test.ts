import { describe, expect, it } from "vitest";
import {
  getLeaderboardTabs,
  normalizeLeaderboardTab,
  shouldEnableLeaderboardFriendLookup,
} from "~/lib/leaderboard-page";

describe("leaderboard page access", () => {
  it("shows the bets tab only for signed-in users", () => {
    expect(getLeaderboardTabs(true)).toEqual(["stats", "bets"]);
    expect(getLeaderboardTabs(false)).toEqual(["stats"]);
  });

  it("falls back to stats when bets is unavailable", () => {
    expect(normalizeLeaderboardTab("bets", false)).toBe("stats");
    expect(normalizeLeaderboardTab("stats", false)).toBe("stats");
    expect(normalizeLeaderboardTab("bets", true)).toBe("bets");
  });

  it("treats unknown tabs as stats", () => {
    expect(normalizeLeaderboardTab("anything-else", true)).toBe("stats");
    expect(normalizeLeaderboardTab(undefined, false)).toBe("stats");
  });

  it("disables the friends lookup until auth resolves and stats is active", () => {
    expect(shouldEnableLeaderboardFriendLookup("bets", true)).toBe(false);
    expect(shouldEnableLeaderboardFriendLookup("stats", false)).toBe(false);
    expect(shouldEnableLeaderboardFriendLookup("stats", true)).toBe(true);
  });
});
