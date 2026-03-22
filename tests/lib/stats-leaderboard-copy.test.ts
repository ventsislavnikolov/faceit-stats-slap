import { describe, expect, it } from "vitest";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";

describe("stats leaderboard copy", () => {
  it("formats the shared-friends summary copy", () => {
    expect(getStatsLeaderboardSummaryCopy("Target", 3, 30)).toBe(
      "Recent squad leaderboard for Target · 3 shared friends in the last 30 days"
    );
  });

  it("formats the no recent matches empty state", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 0,
        sharedFriendCount: 0,
        days: 7,
      })
    ).toBe("No recent matches for Target in the last 7 days.");
  });

  it("formats the no shared-friends empty state", () => {
    expect(
      getStatsLeaderboardEmptyStateCopy({
        targetNickname: "Target",
        targetMatchCount: 4,
        sharedFriendCount: 0,
        days: 30,
      })
    ).toBe("No friends played with Target in the last 30 days.");
  });
});
