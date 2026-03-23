import { describe, expect, it } from "vitest";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";

describe("stats leaderboard copy", () => {
  it("formats the personal-form summary copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 90, 20)).toBe(
      "Showing players you queued with in the last 90 days. Stats are from each player's own last 20 matches."
    );
  });

  it("supports the 730-day preset in summary and empty-state copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 730, 50)).toBe(
      "Showing players you queued with in the last 730 days. Stats are from each player's own last 50 matches."
    );

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 730,
      })
    ).toBe("No recently queued friends for Target in the last 730 days.");
  });

  it("formats queue-specific summary and empty-state copy", () => {
    expect(getStatsLeaderboardSummaryCopy("soavarice", 9, 90, 20, "party")).toBe(
      "Showing players from party matches in the last 90 days. Stats are from each player's own last 20 matches."
    );

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 30,
        queue: "solo",
      })
    ).toBe("No recent solo matches for Target in the last 30 days.");

    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 30,
        queue: "party",
      })
    ).toBe("No recently queued friends for Target in party matches in the last 30 days.");
  });

  it("formats the no recent matches empty state", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 30,
      })
    ).toBe("No recent matches for Target in the last 30 days.");
  });

  it("formats the no recently-queued-friends empty state", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 365,
      })
    ).toBe("No recently queued friends for Target in the last 365 days.");
  });

  it("returns null when the leaderboard has recent matches and shared friends", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 2,
        days: 90,
      })
    ).toBeNull();
  });
});
