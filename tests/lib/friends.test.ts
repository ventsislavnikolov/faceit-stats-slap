import { describe, expect, it } from "vitest";
import { getPlayingFriendIds } from "~/lib/friends";

describe("getPlayingFriendIds", () => {
  it("treats Twitch-live friends as playing when FACEIT live matches are empty", () => {
    expect(
      getPlayingFriendIds([], [
        {
          channel: "bachiyski",
          faceitId: "friend-1",
          isLive: true,
          viewerCount: 12,
          title: "ranked",
          thumbnailUrl: "",
        },
        {
          channel: "offline-friend",
          faceitId: "friend-2",
          isLive: false,
          viewerCount: 0,
          title: "",
          thumbnailUrl: "",
        },
      ])
    ).toEqual(new Set(["friend-1"]));
  });

  it("does not treat recently finished FACEIT cards as currently playing", () => {
    expect(
      getPlayingFriendIds(
        [
          {
            matchId: "finished-match",
            status: "FINISHED",
            map: "de_dust2",
            score: { faction1: 13, faction2: 7 },
            startedAt: 0,
            friendFaction: "faction1",
            friendIds: ["friend-1", "friend-2"],
            teams: {
              faction1: { teamId: "team-1", name: "Team 1", roster: [] },
              faction2: { teamId: "team-2", name: "Team 2", roster: [] },
            },
          },
        ],
        []
      )
    ).toEqual(new Set());
  });
});
