import { describe, expect, it } from "vitest";
import { buildMatchDashboardFriends } from "~/lib/match-dashboard";

describe("buildMatchDashboardFriends", () => {
  it("marks the full active roster as playing for the match dashboard", () => {
    const friends = buildMatchDashboardFriends(
      [
        {
          playerId: "p1",
          nickname: "TibaBG",
          avatar: "",
          skillLevel: 10,
          elo: 2108,
          lifetimeKd: 1.21,
          lifetimeHs: 41,
          lifetimeAdr: 90,
          winRate: 51,
          recentResults: [true, false, true, true, false],
          twitchChannel: "bachiyski",
        },
        {
          playerId: "p2",
          nickname: "F1aw1esss",
          avatar: "",
          skillLevel: 10,
          elo: 2612,
          lifetimeKd: 1.31,
          lifetimeHs: 36,
          lifetimeAdr: 98,
          winRate: 52,
          recentResults: [true, true, true, false, true],
          twitchChannel: null,
        },
      ],
      "1-live-match",
      "ONGOING"
    );

    expect(friends).toEqual([
      expect.objectContaining({
        faceitId: "p1",
        nickname: "TibaBG",
        isPlaying: true,
        currentMatchId: "1-live-match",
      }),
      expect.objectContaining({
        faceitId: "p2",
        nickname: "F1aw1esss",
        isPlaying: true,
        currentMatchId: "1-live-match",
      }),
    ]);
  });

  it("shows a finished roster as not playing", () => {
    const [friend] = buildMatchDashboardFriends(
      [
        {
          playerId: "p1",
          nickname: "TibaBG",
          avatar: "",
          skillLevel: 10,
          elo: 2108,
          lifetimeKd: 1.21,
          lifetimeHs: 41,
          lifetimeAdr: 90,
          winRate: 51,
          recentResults: [true, false, true, true, false],
          twitchChannel: "bachiyski",
        },
      ],
      "1-finished-match",
      "FINISHED"
    );

    expect(friend).toEqual(
      expect.objectContaining({
        faceitId: "p1",
        isPlaying: false,
        currentMatchId: null,
      })
    );
  });
});
