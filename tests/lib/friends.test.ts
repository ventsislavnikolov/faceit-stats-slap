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
});
