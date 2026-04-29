import { describe, expect, it } from "vitest";
import {
  classifyKnownFriendQueue,
  PARTY_FRIEND_THRESHOLD,
} from "~/lib/match-queue";

describe("classifyKnownFriendQueue", () => {
  it("classifies a match as party when the player queued with at least two known friends", () => {
    expect(
      classifyKnownFriendQueue({
        targetPlayerId: "target",
        targetFriendIds: ["friend-1", "friend-2", "friend-3"],
        teams: [
          {
            players: [
              { player_id: "target" },
              { player_id: "friend-1" },
              { player_id: "friend-2" },
              { player_id: "random" },
            ],
          },
        ],
      })
    ).toEqual({
      queueBucket: "party",
      knownQueuedFriendCount: PARTY_FRIEND_THRESHOLD,
      knownQueuedFriendIds: ["friend-1", "friend-2"],
      allTeammateIds: ["friend-1", "friend-2", "random"],
      partySize: 3,
    });
  });

  it("classifies a match as solo when fewer than two known friends are on the same team", () => {
    expect(
      classifyKnownFriendQueue({
        targetPlayerId: "target",
        targetFriendIds: ["friend-1", "friend-2"],
        teams: [
          {
            players: [
              { player_id: "target" },
              { player_id: "friend-1" },
              { player_id: "enemy-1" },
            ],
          },
        ],
      })
    ).toEqual({
      queueBucket: "solo",
      knownQueuedFriendCount: 1,
      knownQueuedFriendIds: ["friend-1"],
      allTeammateIds: ["friend-1", "enemy-1"],
      partySize: 2,
    });
  });

  it("returns unknown when the target team cannot be identified", () => {
    expect(
      classifyKnownFriendQueue({
        targetPlayerId: "target",
        targetFriendIds: ["friend-1", "friend-2"],
        teams: [
          {
            players: [{ player_id: "enemy-1" }],
          },
        ],
      })
    ).toEqual({
      queueBucket: "unknown",
      knownQueuedFriendCount: 0,
      knownQueuedFriendIds: [],
      allTeammateIds: [],
      partySize: null,
    });
  });

  it("returns unknown when the target friend graph is unavailable", () => {
    expect(
      classifyKnownFriendQueue({
        targetPlayerId: "target",
        targetFriendIds: null,
        teams: [
          {
            players: [{ player_id: "target" }, { player_id: "friend-1" }],
          },
        ],
      })
    ).toEqual({
      queueBucket: "unknown",
      knownQueuedFriendCount: 0,
      knownQueuedFriendIds: [],
      allTeammateIds: [],
      partySize: null,
    });
  });
});
