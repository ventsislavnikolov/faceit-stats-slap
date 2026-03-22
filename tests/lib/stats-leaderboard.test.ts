import { describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import { MY_FACEIT_ID } from "~/lib/constants";
import {
  buildPersonalFormLeaderboard,
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
    buildPersonalFormLeaderboard: vi.fn(actual.buildPersonalFormLeaderboard),
    buildSharedStatsLeaderboard: vi.fn(actual.buildSharedStatsLeaderboard),
  };
});

const mockSupabase = vi.hoisted(() => {
  const trackedFriendsRows = [
    { faceit_id: "friend-a", nickname: "Friend A", elo: 2010 },
    { faceit_id: "friend-b", nickname: "Friend B", elo: 1880 },
  ];
  const leaderboardRowsByPlayer = new Map<string, any[]>([
    [
      "target",
      [
        {
          match_id: "match-shared",
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
        {
          match_id: "match-target-only",
          faceit_player_id: "target",
          nickname: "Target",
          played_at: "2026-03-20T10:00:00.000Z",
          kd_ratio: 0.9,
          adr: 55,
          hs_percent: 22,
          kr_ratio: 0.35,
          win: false,
          first_kills: 0,
          clutch_kills: 0,
          utility_damage: 2,
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
          match_id: "match-shared",
          faceit_player_id: "friend-a",
          nickname: "Friend A",
          played_at: "2026-03-21T10:00:00.000Z",
          kd_ratio: 1.2,
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
        {
          match_id: "friend-a-personal-1",
          faceit_player_id: "friend-a",
          nickname: "Friend A",
          played_at: "2026-02-15T09:00:00.000Z",
          kd_ratio: 1.8,
          adr: 100,
          hs_percent: 45,
          kr_ratio: 0.9,
          win: true,
          first_kills: 1,
          clutch_kills: 1,
          utility_damage: 10,
          enemies_flashed: 2,
          entry_count: 1,
          entry_wins: 1,
          sniper_kills: 1,
        },
        {
          match_id: "friend-a-personal-2",
          faceit_player_id: "friend-a",
          nickname: "Friend A",
          played_at: "2026-02-14T08:00:00.000Z",
          kd_ratio: 1.5,
          adr: 98,
          hs_percent: 35,
          kr_ratio: 0.85,
          win: false,
          first_kills: 2,
          clutch_kills: 0,
          utility_damage: 8,
          enemies_flashed: 1,
          entry_count: 2,
          entry_wins: 1,
          sniper_kills: 0,
        },
      ],
    ],
    [
      "friend-b",
      [
        {
          match_id: "friend-b-personal-1",
          faceit_player_id: "friend-b",
          nickname: "Friend B",
          played_at: "2026-02-13T07:00:00.000Z",
          kd_ratio: 2.7,
          adr: 120,
          hs_percent: 55,
          kr_ratio: 1.1,
          win: true,
          first_kills: 2,
          clutch_kills: 1,
          utility_damage: 14,
          enemies_flashed: 4,
          entry_count: 2,
          entry_wins: 2,
          sniper_kills: 1,
        },
      ],
    ],
    ["15844c99-d26e-419e-bd14-30908f502c03", []],
  ]);

  let lastMatchPlayerStatIds: string[] = [];

  const buildMatchPlayerStatsRows = (value: string[], cutoffIso?: string) => ({
    data: value
      .flatMap((faceitId) => leaderboardRowsByPlayer.get(faceitId) ?? [])
      .filter((row) => (cutoffIso ? row.played_at >= cutoffIso : true)),
  });

  const matchPlayerStatsQuery = () => ({
    select: () => ({
      in: (_column: string, value: string[]) => ({
        order: async () => {
          lastMatchPlayerStatIds = value;
          return buildMatchPlayerStatsRows(value);
        },
        gte: (_gteColumn: string, cutoffIso: string) => ({
          order: async () => {
            lastMatchPlayerStatIds = value;
            return buildMatchPlayerStatsRows(value, cutoffIso);
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

describe("buildPersonalFormLeaderboard", () => {
  it("includes the searched player with their own recent form sample", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "target-match-1",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Target",
          elo: 3333,
          kdRatio: 1.3,
          adr: 90,
          hsPercent: 42,
          krRatio: 0.8,
          win: true,
        }),
        makeRow({
          matchId: "target-match-1",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 1.1,
        }),
        makeRow({
          matchId: "target-personal-1",
          faceitId: "target",
          playedAt: "2026-03-22T10:00:00.000Z",
          nickname: "Target",
          elo: 3333,
          kdRatio: 1.5,
          adr: 100,
          hsPercent: 50,
          krRatio: 0.9,
          win: false,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries.map((entry) => entry.faceitId)).toContain("target");
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        faceitId: "target",
        nickname: "Target",
        elo: 3333,
        gamesPlayed: 2,
        avgKd: 1.4,
      })
    );
    expect(result.sharedFriendCount).toBe(1);
  });

  it("uses personal recent matches after a friend qualifies via one shared match", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "target-match-1",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "target-match-1",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kdRatio: 1.2,
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
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-22T09:00:00.000Z",
          kdRatio: 1.6,
          adr: 110,
          hsPercent: 50,
          krRatio: 0.9,
          win: false,
          firstKills: 2,
          clutchKills: 1,
          utilityDamage: 20,
          enemiesFlashed: 5,
          entryCount: 2,
          entryWins: 1,
          sniperKills: 1,
        }),
        makeRow({
          matchId: "friend-a-personal-2",
          faceitId: "friend-a",
          playedAt: "2026-03-22T08:00:00.000Z",
          kdRatio: 1.7,
          adr: 95,
          hsPercent: 35,
          krRatio: 0.85,
          win: true,
          firstKills: 0,
          clutchKills: 0,
          utilityDamage: 8,
          enemiesFlashed: 2,
          entryCount: 1,
          entryWins: 1,
          sniperKills: 0,
        }),
        makeRow({
          matchId: "friend-b-personal-1",
          faceitId: "friend-b",
          playedAt: "2026-03-22T07:00:00.000Z",
          kdRatio: 2.8,
          adr: 120,
        }),
        makeRow({
          matchId: "target-match-2",
          faceitId: "target",
          playedAt: "2026-03-20T10:00:00.000Z",
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a", "friend-b"],
      n: 3,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.targetMatchCount).toBe(2);
    expect(result.sharedFriendCount).toBe(1);
    expect(result.entries.map((entry) => entry.faceitId)).toEqual(["friend-a", "target"]);
    expect(result.entries[0]).toMatchObject({
      gamesPlayed: 3,
      avgKd: 1.5,
      avgAdr: 98.3,
      winRate: 67,
      avgHsPercent: 42,
      avgKrRatio: 0.85,
      avgFirstKills: 1,
      avgClutchKills: 0.33,
      avgUtilityDamage: 13,
      avgEnemiesFlashed: 3.3,
      avgEntryRate: 0.75,
      avgSniperKills: 0.33,
    });
  });

  it("computes entry rate as a normalized fraction from the personal sample", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          entryCount: 4,
          entryWins: 2,
        }),
        makeRow({
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-22T10:00:00.000Z",
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
    const result = buildPersonalFormLeaderboard({
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
          matchId: "friend-a-personal",
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

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      faceitId: "target",
      gamesPlayed: 2,
      avgKd: 0,
    });
    expect(result.sharedFriendCount).toBe(0);
    expect(result.targetMatchCount).toBe(2);
  });

  it("caps each friend to the latest personal matches after they qualify", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-19T10:00:00.000Z",
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-a",
          playedAt: "2026-03-19T10:00:00.000Z",
          kdRatio: 1,
        }),
        makeRow({
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-20T10:00:00.000Z",
          kdRatio: 3,
        }),
        makeRow({
          matchId: "friend-a-personal-2",
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

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-a",
      gamesPlayed: 2,
      avgKd: 4,
    });
  });

  it("returns empty-state metadata when there are no recent shared matches", () => {
    const noRecentTargetMatches = buildPersonalFormLeaderboard({
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

    const noSharedFriends = buildPersonalFormLeaderboard({
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

    expect(noSharedFriends.entries).toEqual([
      expect.objectContaining({
        faceitId: "target",
        gamesPlayed: 1,
      }),
    ]);
    expect(noSharedFriends.targetMatchCount).toBe(1);
    expect(noSharedFriends.sharedFriendCount).toBe(0);
  });

  it("returns the searched player plus recently queued friends scored by personal recent matches", async () => {
    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        getStatsLeaderboard({
          data: {
            targetPlayerId: "target",
            playerIds: ["friend-a", "friend-b"],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        nickname: "Friend A",
        elo: 2010,
        gamesPlayed: 3,
        avgKd: 1.5,
      }),
      expect.objectContaining({
        faceitId: "target",
        nickname: "Target",
        elo: 3333,
        gamesPlayed: 2,
        avgKd: 1,
      }),
    ]);
    expect(result.targetMatchCount).toBe(2);
    expect(result.sharedFriendCount).toBe(1);
  });

  it("does not force-add MY_FACEIT_ID when querying a different target", async () => {
    vi.mocked(buildPersonalFormLeaderboard).mockReturnValueOnce({
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
