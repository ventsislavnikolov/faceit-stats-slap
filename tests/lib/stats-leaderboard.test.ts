import { describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import { MY_FACEIT_ID } from "~/lib/constants";
import {
  buildSharedStatsLeaderboard,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";
import { getStatsLeaderboard } from "~/server/matches";

vi.mock("~/lib/stats-leaderboard", async () => {
  const actual = await vi.importActual<typeof import("~/lib/stats-leaderboard")>(
    "~/lib/stats-leaderboard"
  );
  return {
    ...actual,
    buildSharedStatsLeaderboard: vi.fn(actual.buildSharedStatsLeaderboard),
  };
});

const mockSupabase = vi.hoisted(() => {
  const trackedFriendsRows = [{ faceit_id: "friend-a", nickname: "Friend A", elo: 2010 }];
  const sharedRowsByPlayer = new Map<string, any[]>([
    [
      "target",
      [
        {
          match_id: "match-1",
          faceit_player_id: "target",
          nickname: "Target",
          played_at: "2026-03-21T10:00:00.000Z",
          kd_ratio: 1.1,
          adr: 60,
          hs_percent: 30,
          kr_ratio: 0.4,
          win: true,
          first_kills: 0,
          clutch_kills: 0,
          utility_damage: 4,
          enemies_flashed: 1,
          entry_count: 0,
          entry_wins: 0,
          sniper_kills: 0,
        },
      ],
    ],
    [
      "friend-a",
      [
        {
          match_id: "match-1",
          faceit_player_id: "friend-a",
          nickname: "Friend A",
          played_at: "2026-03-21T10:00:00.000Z",
          kd_ratio: 2,
          adr: 90,
          hs_percent: 40,
          kr_ratio: 0.8,
          win: true,
          first_kills: 1,
          clutch_kills: 0,
          utility_damage: 12,
          enemies_flashed: 3,
          entry_count: 1,
          entry_wins: 1,
          sniper_kills: 0,
        },
      ],
    ],
    ["15844c99-d26e-419e-bd14-30908f502c03", []],
  ]);

  let lastMatchPlayerStatIds: string[] = [];

  const matchPlayerStatsQuery = () => ({
    select: () => ({
      in: (_column: string, value: string[]) => ({
        gte: () => ({
          order: async () => {
            lastMatchPlayerStatIds = value;
            return {
              data: value.flatMap((faceitId) => sharedRowsByPlayer.get(faceitId) ?? []),
            };
          },
        }),
      }),
    }),
  });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "tracked_friends") {
        return {
          select: () => ({
            in: async () => ({ data: trackedFriendsRows }),
          }),
        };
      }

      if (table === "match_player_stats") {
        return matchPlayerStatsQuery();
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    getLastMatchPlayerStatIds: () => lastMatchPlayerStatIds,
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => mockSupabase.supabase,
}));

vi.mock("~/lib/faceit", () => ({
  fetchPlayer: vi.fn(async (playerId: string) => ({
    faceitId: playerId,
    nickname: playerId === "target" ? "Target" : "soavarice",
    avatar: "",
    elo: playerId === "target" ? 3333 : 1690,
    skillLevel: 8,
    country: "BG",
  })),
}));

function makeRow(
  overrides: Pick<SharedStatsLeaderboardRow, "matchId" | "faceitId" | "playedAt"> &
    Partial<SharedStatsLeaderboardRow>
): SharedStatsLeaderboardRow {
  return {
    matchId: overrides.matchId,
    playedAt: overrides.playedAt,
    faceitId: overrides.faceitId,
    nickname: overrides.nickname ?? overrides.faceitId,
    elo: overrides.elo ?? 0,
    kdRatio: overrides.kdRatio ?? 0,
    adr: overrides.adr ?? 0,
    hsPercent: overrides.hsPercent ?? 0,
    krRatio: overrides.krRatio ?? 0,
    win: overrides.win ?? false,
    firstKills: overrides.firstKills ?? 0,
    clutchKills: overrides.clutchKills ?? 0,
    utilityDamage: overrides.utilityDamage ?? 0,
    enemiesFlashed: overrides.enemiesFlashed ?? 0,
    entryCount: overrides.entryCount ?? 0,
    entryWins: overrides.entryWins ?? 0,
    sniperKills: overrides.sniperKills ?? 0,
  };
}

describe("buildSharedStatsLeaderboard", () => {
  it("only includes friends who shared recent matches with the target player", () => {
    const result = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-1",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-1",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 2,
          adr: 90,
          hsPercent: 40,
          krRatio: 0.8,
          win: true,
          firstKills: 1,
          clutchKills: 0,
          utilityDamage: 12,
          enemiesFlashed: 3,
          entryCount: 1,
          entryWins: 1,
          sniperKills: 0,
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "target",
          playedAt: "2026-03-20T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "friend-a",
          playedAt: "2026-03-20T10:00:00.000Z",
          kdRatio: 4,
          adr: 110,
          hsPercent: 50,
          krRatio: 1.2,
          win: false,
          firstKills: 3,
          clutchKills: 1,
          utilityDamage: 20,
          enemiesFlashed: 5,
          entryCount: 2,
          entryWins: 1,
          sniperKills: 1,
        }),
        makeRow({
          matchId: "match-3",
          faceitId: "friend-a",
          playedAt: "2026-03-19T10:00:00.000Z",
          kdRatio: 0.1,
          adr: 10,
          hsPercent: 5,
          krRatio: 0.1,
          win: false,
          firstKills: 0,
          clutchKills: 0,
          utilityDamage: 0,
          enemiesFlashed: 0,
          entryCount: 0,
          entryWins: 0,
          sniperKills: 0,
        }),
        makeRow({
          matchId: "match-4",
          faceitId: "target",
          playedAt: "2026-02-10T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-4",
          faceitId: "friend-a",
          playedAt: "2026-02-10T10:00:00.000Z",
          kdRatio: 10,
        }),
        makeRow({
          matchId: "match-5",
          faceitId: "friend-b",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 9,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a", "friend-b"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.targetMatchCount).toBe(2);
    expect(result.sharedFriendCount).toBe(1);
    expect(result.entries.map((entry) => entry.faceitId)).toEqual(["friend-a"]);
    expect(result.entries[0]).toMatchObject({
      gamesPlayed: 2,
      avgKd: 3,
      avgAdr: 100,
      winRate: 50,
      avgHsPercent: 45,
      avgKrRatio: 1,
      avgFirstKills: 2,
      avgClutchKills: 0.5,
      avgUtilityDamage: 16,
      avgEnemiesFlashed: 4,
      avgEntryRate: 0.67,
      avgSniperKills: 0.5,
    });
  });

  it("computes entry rate as a normalized fraction", () => {
    const result = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-1",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-1",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          entryCount: 4,
          entryWins: 2,
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "target",
          playedAt: "2026-03-20T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "friend-a",
          playedAt: "2026-03-20T10:00:00.000Z",
          entryCount: 6,
          entryWins: 3,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries[0].avgEntryRate).toBe(0.5);
  });

  it("skips rows with invalid playedAt values", () => {
    const result = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-1",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-1",
          faceitId: "friend-a",
          playedAt: null,
          kdRatio: 99,
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "target",
          playedAt: "2026-03-20T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "friend-a",
          playedAt: "not-a-date",
          kdRatio: 77,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries).toHaveLength(0);
    expect(result.sharedFriendCount).toBe(0);
    expect(result.targetMatchCount).toBe(2);
  });

  it("caps each friend to the latest shared matches", () => {
    const result = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-1",
          faceitId: "target",
          playedAt: "2026-03-19T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-1",
          faceitId: "friend-a",
          playedAt: "2026-03-19T10:00:00.000Z",
          kdRatio: 1,
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "target",
          playedAt: "2026-03-20T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-2",
          faceitId: "friend-a",
          playedAt: "2026-03-20T10:00:00.000Z",
          kdRatio: 3,
        }),
        makeRow({
          matchId: "match-3",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-3",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 5,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 2,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-a",
      gamesPlayed: 2,
      avgKd: 4,
    });
  });

  it("returns empty-state metadata when there are no recent shared matches", () => {
    const noRecentTargetMatches = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-old",
          faceitId: "target",
          playedAt: "2026-03-01T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-old",
          faceitId: "friend-a",
          playedAt: "2026-03-01T10:00:00.000Z",
          kdRatio: 7,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 7,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(noRecentTargetMatches.entries).toEqual([]);
    expect(noRecentTargetMatches.targetMatchCount).toBe(0);
    expect(noRecentTargetMatches.sharedFriendCount).toBe(0);

    const noSharedFriends = buildSharedStatsLeaderboard({
      rows: [
        makeRow({
          matchId: "match-target",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "match-other",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 8,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 7,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(noSharedFriends.entries).toEqual([]);
    expect(noSharedFriends.targetMatchCount).toBe(1);
    expect(noSharedFriends.sharedFriendCount).toBe(0);
  });

  it("returns the shared leaderboard result contract from the server query", async () => {
    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        getStatsLeaderboard({
          data: {
            targetPlayerId: "target",
            playerIds: ["friend-a"],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(result).toEqual({
      entries: [
        expect.objectContaining({
          faceitId: "friend-a",
          nickname: "Friend A",
          elo: 2010,
          gamesPlayed: 1,
        }),
      ],
      targetMatchCount: 1,
      sharedFriendCount: 1,
    });
  });

  it("does not force-add MY_FACEIT_ID when querying a different target", async () => {
    vi.mocked(buildSharedStatsLeaderboard).mockReturnValueOnce({
      entries: [
        {
          faceitId: "target",
          nickname: "Target",
          elo: 0,
          gamesPlayed: 1,
          avgKd: 1,
          avgAdr: 60,
          winRate: 100,
          avgHsPercent: 30,
          avgKrRatio: 0.4,
          avgFirstKills: 0,
          avgClutchKills: 0,
          avgUtilityDamage: 4,
          avgEnemiesFlashed: 1,
          avgEntryRate: 0,
          avgSniperKills: 0,
        },
      ],
      targetMatchCount: 1,
      sharedFriendCount: 1,
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        getStatsLeaderboard({
          data: {
            targetPlayerId: "target",
            playerIds: ["friend-a"],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(mockSupabase.getLastMatchPlayerStatIds()).toEqual(["target", "friend-a"]);
    expect(mockSupabase.getLastMatchPlayerStatIds()).not.toContain(MY_FACEIT_ID);
    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "target",
        elo: 3333,
      }),
    ]);
  });
});
