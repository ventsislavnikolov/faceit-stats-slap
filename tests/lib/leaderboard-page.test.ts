import { describe, expect, it } from "vitest";
import {
  getLeaderboardTabs,
  normalizeLeaderboardTab,
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
});
