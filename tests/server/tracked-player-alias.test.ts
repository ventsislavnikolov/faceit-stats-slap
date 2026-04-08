import { afterEach, describe, expect, it, vi } from "vitest";

const trackedAliasMocks = vi.hoisted(() => ({
  loadTrackedPlayersSnapshot: vi.fn(),
  findLatestHistoryPlayedAt: vi.fn(),
  findLatestLeaderboardPlayedAt: vi.fn(),
  findLatestPartySessionPlayedAt: vi.fn(),
  findLatestRecentMatchPlayedAt: vi.fn(),
  findLatestRecentMatchesPlayedAt: vi.fn(),
  findCurrentlyLiveTrackedPlayers: vi.fn(),
}));

vi.mock("~/server/tracked-players.server", () => ({
  loadTrackedPlayersSnapshot: trackedAliasMocks.loadTrackedPlayersSnapshot,
}));

vi.mock("~/server/tracked-player-selectors.server", () => ({
  findLatestHistoryPlayedAt: trackedAliasMocks.findLatestHistoryPlayedAt,
  findLatestLeaderboardPlayedAt:
    trackedAliasMocks.findLatestLeaderboardPlayedAt,
  findLatestPartySessionPlayedAt:
    trackedAliasMocks.findLatestPartySessionPlayedAt,
  findLatestRecentMatchPlayedAt:
    trackedAliasMocks.findLatestRecentMatchPlayedAt,
  findLatestRecentMatchesPlayedAt:
    trackedAliasMocks.findLatestRecentMatchesPlayedAt,
  findCurrentlyLiveTrackedPlayers:
    trackedAliasMocks.findCurrentlyLiveTrackedPlayers,
}));

import {
  resolveTrackedPlayerForFriends,
  resolveTrackedPlayerForHistory,
  resolveTrackedPlayerForLastParty,
  resolveTrackedPlayerForLeaderboard,
} from "~/server/tracked-player-alias.server";

afterEach(() => {
  vi.clearAllMocks();
  trackedAliasMocks.findLatestRecentMatchesPlayedAt.mockReset();
});

describe("tracked player alias resolver", () => {
  it("returns null when there are no active tracked players", async () => {
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([]);

    await expect(
      resolveTrackedPlayerForHistory({
        matches: 20,
        queue: "party",
      })
    ).resolves.toBeNull();
  });

  it("chooses the tracked player with the freshest qualifying history row", async () => {
    trackedAliasMocks.findLatestRecentMatchesPlayedAt.mockResolvedValue(
      new Map()
    );
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([
      { faceitId: "player-a", nickname: "PlayerA" },
      { faceitId: "player-b", nickname: "PlayerB" },
      { faceitId: "player-c", nickname: "PlayerC" },
    ]);
    trackedAliasMocks.findLatestHistoryPlayedAt.mockImplementation(
      async ({ playerId }: { playerId: string }) =>
        ({
          "player-a": "2026-04-06T11:00:00.000Z",
          "player-b": "2026-04-07T13:00:00.000Z",
          "player-c": null,
        })[playerId] ?? null
    );

    await expect(
      resolveTrackedPlayerForHistory({
        matches: 20,
        queue: "party",
      })
    ).resolves.toEqual({
      faceitId: "player-b",
      nickname: "PlayerB",
    });
  });

  it("chooses the tracked player with the freshest qualifying leaderboard basis", async () => {
    trackedAliasMocks.findLatestRecentMatchesPlayedAt.mockResolvedValue(
      new Map()
    );
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([
      { faceitId: "player-a", nickname: "PlayerA" },
      { faceitId: "player-b", nickname: "PlayerB" },
    ]);
    trackedAliasMocks.findLatestLeaderboardPlayedAt.mockImplementation(
      async ({ targetPlayerId }: { targetPlayerId: string }) =>
        ({
          "player-a": "2026-04-01T10:00:00.000Z",
          "player-b": "2026-04-05T10:00:00.000Z",
        })[targetPlayerId] ?? null
    );

    await expect(
      resolveTrackedPlayerForLeaderboard({
        matches: 50,
        queue: "solo",
        last: 90,
      })
    ).resolves.toEqual({
      faceitId: "player-b",
      nickname: "PlayerB",
    });
  });

  it("chooses the tracked player with the freshest qualifying last-party session", async () => {
    trackedAliasMocks.findLatestRecentMatchesPlayedAt.mockResolvedValue(
      new Map()
    );
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([
      { faceitId: "player-a", nickname: "PlayerA" },
      { faceitId: "player-b", nickname: "PlayerB" },
    ]);
    trackedAliasMocks.findLatestPartySessionPlayedAt.mockImplementation(
      async ({ playerId }: { playerId: string }) =>
        ({
          "player-a": null,
          "player-b": "2026-04-08T18:00:00.000Z",
        })[playerId] ?? null
    );

    await expect(
      resolveTrackedPlayerForLastParty({
        date: "2026-04-08",
      })
    ).resolves.toEqual({
      faceitId: "player-b",
      nickname: "PlayerB",
    });
  });

  it("prefers a currently live tracked player for the friends view", async () => {
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([
      { faceitId: "live-player", nickname: "LivePlayer" },
      { faceitId: "recent-player", nickname: "RecentPlayer" },
    ]);
    trackedAliasMocks.findCurrentlyLiveTrackedPlayers.mockResolvedValue([
      "live-player",
    ]);

    await expect(resolveTrackedPlayerForFriends()).resolves.toEqual({
      faceitId: "live-player",
      nickname: "LivePlayer",
    });
    expect(
      trackedAliasMocks.findLatestRecentMatchPlayedAt
    ).not.toHaveBeenCalled();
  });

  it("falls back to the freshest recent tracked match for the friends view", async () => {
    trackedAliasMocks.loadTrackedPlayersSnapshot.mockResolvedValue([
      { faceitId: "player-a", nickname: "PlayerA" },
      { faceitId: "player-b", nickname: "PlayerB" },
    ]);
    trackedAliasMocks.findCurrentlyLiveTrackedPlayers.mockResolvedValue([]);
    trackedAliasMocks.findLatestRecentMatchesPlayedAt.mockResolvedValue(
      new Map([
        ["player-a", "2026-04-07T09:00:00.000Z"],
        ["player-b", "2026-04-08T09:00:00.000Z"],
      ])
    );

    await expect(resolveTrackedPlayerForFriends()).resolves.toEqual({
      faceitId: "player-b",
      nickname: "PlayerB",
    });
    expect(
      trackedAliasMocks.findLatestRecentMatchPlayedAt
    ).not.toHaveBeenCalled();
  });
});
