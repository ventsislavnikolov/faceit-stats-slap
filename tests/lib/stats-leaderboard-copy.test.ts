import { describe, expect, it } from "vitest";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";

describe("stats leaderboard copy", () => {
  it("formats the personal-form summary copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 90, 20)).toBe(
      "Showing friends of soavarice in the last 90 days. Stats are from each player's own last 20 matches."
    );
  });

  it("formats the yesterday summary and empty-state copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 30, "yesterday")).toBe(
      "Showing friends of soavarice who played yesterday. Stats are from yesterday's matches only."
    );

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 30,
        n: "yesterday",
      })
    ).toBe("No friends of Target played yesterday.");

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 2,
        sharedFriendCount: 0,
        days: 30,
        n: "yesterday",
        queue: "party",
      })
    ).toBe("No friends of Target played party matches yesterday.");
  });

  it("supports the 730-day preset in summary and empty-state copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 730, 50)).toBe(
      "Showing friends of soavarice in the last 730 days. Stats are from each player's own last 50 matches."
    );

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 730,
        n: 50,
      })
    ).toBe("No friends of Target played in the last 730 days.");
  });

  it("formats queue-specific summary and empty-state copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 90, 20, "party")).toBe(
      "Showing friends of soavarice from party matches in the last 90 days. Stats are from each player's own last 20 matches."
    );

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 30,
        n: 20,
        queue: "solo",
      })
    ).toBe("No friends of Target played solo matches in the last 30 days.");

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 30,
        n: 20,
        queue: "party",
      })
    ).toBe("No friends of Target played party matches in the last 30 days.");
  });

  it("formats the no recent friends empty state", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 30,
        n: 20,
      })
    ).toBe("No friends of Target played in the last 30 days.");
  });

  it("formats the no recent friends empty state for longer windows", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 365,
        n: 20,
      })
    ).toBe("No friends of Target played in the last 365 days.");
  });

  it("returns null when the leaderboard has recent matches and shared friends", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 2,
        days: 90,
        n: 20,
      })
    ).toBeNull();
  });
});
