import { describe, expect, it, vi } from "vitest";
import { MY_FACEIT_ID } from "~/lib/constants";
import { fetchMatchStats } from "~/lib/faceit";
import {
  buildPersonalFormLeaderboard,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";
import { getStatsLeaderboard } from "~/server/matches";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";

vi.mock("~/lib/stats-leaderboard", async () => {
  const actual = await vi.importActual<
    typeof import("~/lib/stats-leaderboard")
  >("~/lib/stats-leaderboard");
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
          kills: 19,
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
          kills: 15,
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
          kills: 22,
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
          kills: 24,
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
          kills: 21,
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
          kills: 27,
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

  const getAllLeaderboardRows = () =>
    [...leaderboardRowsByPlayer.values()]
      .flat()
      .sort((a, b) => b.played_at.localeCompare(a.played_at));

  const buildMatchPlayerStatsPage = (
    rows: any[],
    from = 0,
    to = rows.length - 1
  ) => ({
    data: rows.slice(from, to + 1),
  });

  const buildOrderedRangeQuery = (rows: any[]) => ({
    order: () => ({
      range: async (from: number, to: number) =>
        buildMatchPlayerStatsPage(rows, from, to),
    }),
  });

  const matchPlayerStatsQuery = () => ({
    select: () => ({
      eq: (column: string, value: string) => ({
        gte: (_gteColumn: string, cutoffIso: string) => ({
          order: () => {
            if (column !== "faceit_player_id") {
              throw new Error(`Unexpected eq column: ${column}`);
            }

            const rows = (leaderboardRowsByPlayer.get(value) ?? [])
              .filter((row) => row.played_at >= cutoffIso)
              .sort((a, b) => b.played_at.localeCompare(a.played_at));

            return {
              range: async (from: number, to: number) =>
                buildMatchPlayerStatsPage(rows, from, to),
            };
          },
        }),
      }),
      in: (column: string, value: string[]) => {
        if (column === "faceit_player_id") {
          lastMatchPlayerStatIds = value;
          const getRows = (cutoffIso?: string) =>
            value
              .flatMap(
                (faceitId) => leaderboardRowsByPlayer.get(faceitId) ?? []
              )
              .filter((row) => (cutoffIso ? row.played_at >= cutoffIso : true))
              .sort((a, b) => b.played_at.localeCompare(a.played_at));

          return {
            gte: (_gteColumn: string, cutoffIso: string) =>
              buildOrderedRangeQuery(getRows(cutoffIso)),
            ...buildOrderedRangeQuery(getRows()),
          };
        }

        if (column === "match_id") {
          const rows = getAllLeaderboardRows().filter((row) =>
            value.includes(row.match_id)
          );
          return {
            data: rows,
            in: (_nextColumn: string, _nextValue: string[]) => ({
              order: () => ({
                range: async (from: number, to: number) =>
                  buildMatchPlayerStatsPage(rows, from, to),
              }),
            }),
            order: async () => ({ data: rows }),
          };
        }

        throw new Error(`Unexpected in column: ${column}`);
      },
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
    setLeaderboardRows(faceitId: string, rows: any[]) {
      leaderboardRowsByPlayer.set(faceitId, rows);
    },
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => mockSupabase.supabase,
}));

vi.mock("~/lib/faceit", () => ({
  fetchMatchStats: vi.fn(async (matchId: string) => ({
    rounds: [
      {
        teams: [
          {
            players:
              matchId === "match-shared"
                ? [
                    { player_id: "target" },
                    { player_id: "friend-a" },
                    { player_id: "friend-b" },
                  ]
                : [{ player_id: "target" }, { player_id: "random" }],
          },
        ],
      },
    ],
  })),
  fetchPlayer: vi.fn(async (playerId: string) => ({
    faceitId: playerId,
    nickname: playerId === "target" ? "Target" : "soavarice",
    avatar: "",
    elo: playerId === "target" ? 3333 : 1690,
    skillLevel: 8,
    country: "BG",
    friendsIds: playerId === "target" ? ["friend-a", "friend-b"] : [],
  })),
}));

function makeRow(
  overrides: Pick<
    SharedStatsLeaderboardRow,
    "matchId" | "faceitId" | "playedAt"
  > &
    Partial<SharedStatsLeaderboardRow>
): SharedStatsLeaderboardRow {
  return {
    matchId: overrides.matchId,
    playedAt: overrides.playedAt,
    faceitId: overrides.faceitId,
    nickname: overrides.nickname ?? overrides.faceitId,
    elo: overrides.elo ?? 0,
    kills: overrides.kills ?? 0,
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
          kills: 18,
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
          kills: 24,
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
        avgKills: 21,
        avgKd: 1.4,
      })
    );
    expect(result.sharedFriendCount).toBe(1);
  });

  it("uses personal recent matches for every active friend in the selected window", () => {
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
          kills: 21,
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
          kills: 27,
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
          kills: 20,
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
    expect(result.sharedFriendCount).toBe(2);
    expect(result.entries.map((entry) => entry.faceitId)).toEqual([
      "friend-b",
      "friend-a",
      "target",
    ]);
    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-b",
      gamesPlayed: 1,
      avgKills: 0,
      avgImpact: 193.3,
      avgKd: 2.8,
      avgAdr: 120,
      winRate: 0,
      avgHsPercent: 0,
      avgKrRatio: 0,
      avgFirstKills: 0,
      avgClutchKills: 0,
      avgUtilityDamage: 0,
      avgEnemiesFlashed: 0,
      avgEntryRate: 0,
      avgSniperKills: 0,
    });
    expect(result.entries[1]).toMatchObject({
      faceitId: "friend-a",
      gamesPlayed: 3,
      avgKills: 22.67,
      avgImpact: 158.1,
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

  it("scores impact relative to elo-adjusted expectations per match", () => {
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
          elo: 2010,
          kdRatio: 1.2,
          adr: 90,
          krRatio: 0.8,
          win: true,
          entryCount: 1,
          entryWins: 1,
        }),
        makeRow({
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-22T09:00:00.000Z",
          elo: 2010,
          kdRatio: 1.6,
          adr: 110,
          krRatio: 0.9,
          win: false,
          entryCount: 2,
          entryWins: 1,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-a",
      avgImpact: 135,
    });
  });

  it("sorts by impact before nickname and games played", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-high-kd",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Raw Fragger",
          elo: 900,
          kdRatio: 1.45,
          adr: 82,
          krRatio: 0.76,
          win: false,
          entryCount: 2,
          entryWins: 1,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-high-elo",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Hard Lobby",
          elo: 2600,
          kdRatio: 1.35,
          adr: 99,
          krRatio: 0.86,
          win: true,
          entryCount: 2,
          entryWins: 1,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-high-kd", "friend-high-elo"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries.map((entry) => entry.faceitId)).toEqual([
      "friend-high-elo",
      "friend-high-kd",
      "target",
    ]);
    expect(result.entries[0].avgImpact).toBeGreaterThan(
      result.entries[1].avgImpact
    );
    expect(result.entries[0].avgKd).toBeLessThan(result.entries[1].avgKd);
  });

  it("raises impact expectations for players above 2000 elo", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-2070",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "TibaBG",
          elo: 2070,
          kdRatio: 1.25,
          adr: 93,
          krRatio: 0.85,
          win: true,
          entryCount: 2,
          entryWins: 1,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-2574",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "F1aw1esss",
          elo: 2574,
          kdRatio: 1.25,
          adr: 93,
          krRatio: 0.85,
          win: true,
          entryCount: 2,
          entryWins: 1,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-2070", "friend-2574"],
      n: 20,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    const lowerElo = result.entries.find(
      (entry) => entry.faceitId === "friend-2070"
    );
    const higherElo = result.entries.find(
      (entry) => entry.faceitId === "friend-2574"
    );

    expect(lowerElo?.avgImpact).toBeGreaterThan(higherElo?.avgImpact ?? 0);
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

  it("computes average kills per match from the capped personal sample", () => {
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
          kills: 16,
        }),
        makeRow({
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-22T10:00:00.000Z",
          kills: 25,
        }),
        makeRow({
          matchId: "friend-a-personal-2",
          faceitId: "friend-a",
          playedAt: "2026-03-22T09:00:00.000Z",
          kills: 19,
        }),
        makeRow({
          matchId: "friend-a-personal-3",
          faceitId: "friend-a",
          playedAt: "2026-03-22T08:00:00.000Z",
          kills: 12,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 2,
      days: 30,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-a",
      gamesPlayed: 2,
      avgKills: 22,
    });
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
        faceitId: "friend-a",
        gamesPlayed: 1,
      }),
      expect.objectContaining({
        faceitId: "target",
        gamesPlayed: 1,
      }),
    ]);
    expect(noSharedFriends.targetMatchCount).toBe(1);
    expect(noSharedFriends.sharedFriendCount).toBe(1);
  });

  it("includes friends with recent matches even when they did not queue with the target", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "friend-a-personal-1",
          faceitId: "friend-a",
          playedAt: "2026-03-21T10:00:00.000Z",
          kills: 24,
          kdRatio: 1.6,
          adr: 99,
          hsPercent: 41,
          krRatio: 0.82,
          win: true,
        }),
        makeRow({
          matchId: "target-old",
          faceitId: "target",
          playedAt: "2026-03-01T10:00:00.000Z",
          kills: 10,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 7,
      now: "2026-03-22T12:00:00.000Z",
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        gamesPlayed: 1,
        avgKills: 24,
      }),
    ]);
    expect(result.targetMatchCount).toBe(0);
    expect(result.sharedFriendCount).toBe(1);
  });

  it("falls back to the faceit id when the latest row has no nickname", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Target",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-empty",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "",
          kdRatio: 1,
          win: true,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-empty"],
      n: 20,
      days: 30,
      now: "2026-03-22T00:00:00.000Z",
    });

    expect(result.entries[0]).toMatchObject({
      faceitId: "friend-empty",
      nickname: "friend-empty",
    });
    expect(result.sharedFriendCount).toBe(1);
  });

  it("breaks leaderboard ties by games played and then nickname", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Target",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-bravo",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Bravo",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "bravo-personal",
          faceitId: "friend-bravo",
          playedAt: "2026-03-20T10:00:00.000Z",
          nickname: "Bravo",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-alpha",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Alpha",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-charlie",
          playedAt: "2026-03-21T10:00:00.000Z",
          nickname: "Charlie",
          kdRatio: 1,
          win: true,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-bravo", "friend-alpha", "friend-charlie"],
      n: 20,
      days: 30,
      now: "2026-03-22T00:00:00.000Z",
    });

    expect(result.entries.map((entry) => entry.faceitId)).toEqual([
      "friend-bravo",
      "friend-alpha",
      "friend-charlie",
      "target",
    ]);
  });

  it("accepts Date objects for row timestamps and the comparison clock", () => {
    const result = buildPersonalFormLeaderboard({
      rows: [
        makeRow({
          matchId: "shared-match",
          faceitId: "target",
          playedAt: new Date("2026-03-21T10:00:00.000Z"),
          nickname: "Target",
          kdRatio: 1,
          win: true,
        }),
        makeRow({
          matchId: "shared-match",
          faceitId: "friend-a",
          playedAt: new Date("2026-03-21T10:00:00.000Z"),
          nickname: "Friend A",
          kdRatio: 1.5,
          win: true,
        }),
      ],
      targetPlayerId: "target",
      friendIds: ["friend-a"],
      n: 20,
      days: 30,
      now: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        avgKd: 1.5,
      }),
      expect.objectContaining({
        faceitId: "target",
      }),
    ]);
  });

  it("returns the searched player's active friend network scored by personal recent matches", async () => {
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
        gamesPlayed: 1,
        avgKills: 22,
        avgImpact: 117.2,
        avgKd: 1.2,
      }),
      expect.objectContaining({
        faceitId: "target",
        nickname: "Target",
        elo: 3333,
        gamesPlayed: 2,
        avgKills: 17,
        avgKd: 1,
      }),
    ]);
    expect(result.targetMatchCount).toBe(2);
    expect(result.sharedFriendCount).toBe(1);
  });

  it("limits target and friend samples to the previous Europe/Sofia calendar day when yesterday is selected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));

    mockSupabase.setLeaderboardRows("target", [
      {
        match_id: "today-match",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-24T08:00:00.000Z",
        kills: 30,
        kd_ratio: 2,
        adr: 100,
        hs_percent: 50,
        kr_ratio: 1,
        win: true,
        first_kills: 2,
        clutch_kills: 1,
        utility_damage: 8,
        enemies_flashed: 2,
        entry_count: 2,
        entry_wins: 2,
        sniper_kills: 1,
      },
      {
        match_id: "yesterday-shared",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-23T10:00:00.000Z",
        kills: 19,
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
        match_id: "older-target",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-22T18:00:00.000Z",
        kills: 12,
        kd_ratio: 0.8,
        adr: 50,
        hs_percent: 20,
        kr_ratio: 0.3,
        win: false,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 2,
        enemies_flashed: 1,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
    ]);
    mockSupabase.setLeaderboardRows("friend-a", [
      {
        match_id: "today-friend",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-24T07:00:00.000Z",
        kills: 35,
        kd_ratio: 2.2,
        adr: 110,
        hs_percent: 48,
        kr_ratio: 0.95,
        win: true,
        first_kills: 2,
        clutch_kills: 1,
        utility_damage: 11,
        enemies_flashed: 3,
        entry_count: 2,
        entry_wins: 2,
        sniper_kills: 1,
      },
      {
        match_id: "yesterday-shared",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-23T10:00:00.000Z",
        kills: 22,
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
        match_id: "older-friend",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-22T12:00:00.000Z",
        kills: 18,
        kd_ratio: 1,
        adr: 70,
        hs_percent: 33,
        kr_ratio: 0.6,
        win: false,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 5,
        enemies_flashed: 1,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
    ]);

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
            n: "yesterday",
            days: 30,
          },
        } as any)
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        gamesPlayed: 1,
        avgKills: 22,
      }),
      expect.objectContaining({
        faceitId: "target",
        gamesPlayed: 1,
        avgKills: 19,
      }),
    ]);
    expect(result.targetMatchCount).toBe(1);
    expect(result.sharedFriendCount).toBe(1);
  });

  it("keeps friends eligible even when the qualifying shared match falls past the first 1000 combined rows", async () => {
    const sharedPlayedAt = "2026-03-20T00:00:00.000Z";
    mockSupabase.setLeaderboardRows(
      "target",
      Array.from({ length: 1000 }, (_, index) => ({
        match_id: `target-recent-${index}`,
        faceit_player_id: "target",
        nickname: "Target",
        played_at: new Date(
          Date.UTC(2026, 2, 21, 23, 59 - index)
        ).toISOString(),
        kills: 15,
        kd_ratio: 1,
        adr: 70,
        hs_percent: 30,
        kr_ratio: 0.65,
        win: index % 2 === 0,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 4,
        enemies_flashed: 1,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      })).concat([
        {
          match_id: "target-shared-old",
          faceit_player_id: "target",
          nickname: "Target",
          played_at: sharedPlayedAt,
          kills: 17,
          kd_ratio: 1.1,
          adr: 72,
          hs_percent: 34,
          kr_ratio: 0.68,
          win: true,
          first_kills: 0,
          clutch_kills: 0,
          utility_damage: 5,
          enemies_flashed: 1,
          entry_count: 0,
          entry_wins: 0,
          sniper_kills: 0,
        },
      ])
    );
    mockSupabase.setLeaderboardRows(
      "friend-a",
      Array.from({ length: 20 }, (_, index) => ({
        match_id: `friend-a-recent-${index}`,
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: new Date(
          Date.UTC(2026, 2, 21, 22, 59 - index)
        ).toISOString(),
        kills: 20 + (index % 3),
        kd_ratio: 1.2,
        adr: 82,
        hs_percent: 40,
        kr_ratio: 0.75,
        win: true,
        first_kills: 1,
        clutch_kills: 0,
        utility_damage: 8,
        enemies_flashed: 2,
        entry_count: 1,
        entry_wins: 1,
        sniper_kills: 0,
      })).concat([
        {
          match_id: "target-shared-old",
          faceit_player_id: "friend-a",
          nickname: "Friend A",
          played_at: sharedPlayedAt,
          kills: 19,
          kd_ratio: 1.15,
          adr: 78,
          hs_percent: 38,
          kr_ratio: 0.72,
          win: true,
          first_kills: 1,
          clutch_kills: 0,
          utility_damage: 7,
          enemies_flashed: 2,
          entry_count: 1,
          entry_wins: 1,
          sniper_kills: 0,
        },
      ])
    );

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

    expect(result.entries.map((entry) => entry.faceitId)).toContain("friend-a");
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
          avgImpact: 100,
          avgKd: 1,
          avgAdr: 60,
          winRate: 100,
          avgHsPercent: 30,
          avgKills: 17,
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

    expect(mockSupabase.getLastMatchPlayerStatIds()).toEqual([
      "target",
      "friend-a",
    ]);
    expect(mockSupabase.getLastMatchPlayerStatIds()).not.toContain(
      MY_FACEIT_ID
    );
    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "target",
        elo: 3333,
      }),
    ]);
  });

  it("skips the live elo lookup when the leaderboard does not include the target", async () => {
    vi.mocked(buildPersonalFormLeaderboard).mockReturnValueOnce({
      entries: [
        {
          faceitId: "friend-a",
          nickname: "Friend A",
          elo: 2010,
          gamesPlayed: 1,
          avgImpact: 126.7,
          avgKd: 1.2,
          avgAdr: 80,
          winRate: 100,
          avgHsPercent: 40,
          avgKills: 20,
          avgKrRatio: 0.8,
          avgFirstKills: 1,
          avgClutchKills: 0,
          avgUtilityDamage: 10,
          avgEnemiesFlashed: 2,
          avgEntryRate: 1,
          avgSniperKills: 0,
        },
      ],
      targetMatchCount: 0,
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

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        elo: 2010,
      }),
    ]);
  });

  it("normalizes nullable utility and flash stats to zero", async () => {
    mockSupabase.setLeaderboardRows("target", [
      {
        match_id: "match-shared",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: 19,
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
    ]);
    mockSupabase.setLeaderboardRows("friend-null", [
      {
        match_id: "match-shared",
        faceit_player_id: "friend-null",
        nickname: "",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: null,
        kd_ratio: null,
        adr: null,
        hs_percent: null,
        kr_ratio: null,
        win: true,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: null,
        enemies_flashed: null,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
    ]);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        getStatsLeaderboard({
          data: {
            targetPlayerId: "target",
            playerIds: ["friend-null"],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(
      result.entries.find((entry) => entry.faceitId === "friend-null")
    ).toMatchObject({
      faceitId: "friend-null",
      nickname: "friend-null",
      avgKills: 0,
      avgKd: 0,
      avgAdr: 0,
      avgHsPercent: 0,
      avgKrRatio: 0,
      avgUtilityDamage: 0,
      avgEnemiesFlashed: 0,
    });
  });

  it("filters each friend's personal sample to cohort-based party matches", async () => {
    mockSupabase.setLeaderboardRows("target", [
      {
        match_id: "match-party-shared",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: 19,
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
        match_id: "match-party-two",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-20T10:00:00.000Z",
        kills: 17,
        kd_ratio: 1,
        adr: 58,
        hs_percent: 28,
        kr_ratio: 0.38,
        win: true,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 3,
        enemies_flashed: 1,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
      {
        match_id: "match-target-solo",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-19T10:00:00.000Z",
        kills: 15,
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
    ]);
    mockSupabase.setLeaderboardRows("friend-a", [
      {
        match_id: "match-party-shared",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: 22,
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
        match_id: "match-party-two",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-20T10:00:00.000Z",
        kills: 24,
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
        match_id: "match-friend-a-solo",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-22T10:00:00.000Z",
        kills: 40,
        kd_ratio: 2.4,
        adr: 120,
        hs_percent: 55,
        kr_ratio: 1.1,
        win: true,
        first_kills: 2,
        clutch_kills: 1,
        utility_damage: 15,
        enemies_flashed: 4,
        entry_count: 2,
        entry_wins: 2,
        sniper_kills: 1,
      },
    ]);
    mockSupabase.setLeaderboardRows("friend-b", [
      {
        match_id: "match-party-shared",
        faceit_player_id: "friend-b",
        nickname: "Friend B",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: 18,
        kd_ratio: 1.1,
        adr: 78,
        hs_percent: 38,
        kr_ratio: 0.7,
        win: true,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 8,
        enemies_flashed: 2,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
      {
        match_id: "match-party-two",
        faceit_player_id: "friend-b",
        nickname: "Friend B",
        played_at: "2026-03-20T10:00:00.000Z",
        kills: 16,
        kd_ratio: 1,
        adr: 70,
        hs_percent: 32,
        kr_ratio: 0.65,
        win: true,
        first_kills: 0,
        clutch_kills: 0,
        utility_damage: 7,
        enemies_flashed: 2,
        entry_count: 0,
        entry_wins: 0,
        sniper_kills: 0,
      },
    ]);
    vi.mocked(fetchMatchStats).mockImplementation(async (matchId: string) => ({
      rounds: [
        {
          teams: [
            {
              players:
                matchId === "match-target-solo" ||
                matchId === "match-friend-a-solo"
                  ? [{ player_id: "target" }, { player_id: "random" }]
                  : [
                      { player_id: "target" },
                      { player_id: "friend-a" },
                      { player_id: "friend-b" },
                    ],
            },
          ],
        },
      ],
    }));

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
            n: 2,
            days: 30,
            queue: "party",
          },
        } as any)
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        gamesPlayed: 2,
        avgKills: 23,
      }),
      expect.objectContaining({
        faceitId: "target",
        gamesPlayed: 2,
        avgKills: 18,
      }),
      expect.objectContaining({
        faceitId: "friend-b",
        gamesPlayed: 2,
        avgKills: 17,
      }),
    ]);
    expect(result.targetMatchCount).toBe(2);
    expect(result.sharedFriendCount).toBe(2);
  });

  it("keeps solo-active friends when only their own solo matches remain", async () => {
    mockSupabase.setLeaderboardRows("target", [
      {
        match_id: "match-target-solo",
        faceit_player_id: "target",
        nickname: "Target",
        played_at: "2026-03-21T10:00:00.000Z",
        kills: 15,
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
    ]);
    mockSupabase.setLeaderboardRows("friend-a", [
      {
        match_id: "match-friend-a-solo",
        faceit_player_id: "friend-a",
        nickname: "Friend A",
        played_at: "2026-03-20T10:00:00.000Z",
        kills: 40,
        kd_ratio: 2.4,
        adr: 120,
        hs_percent: 55,
        kr_ratio: 1.1,
        win: true,
        first_kills: 2,
        clutch_kills: 1,
        utility_damage: 15,
        enemies_flashed: 4,
        entry_count: 2,
        entry_wins: 2,
        sniper_kills: 1,
      },
    ]);
    mockSupabase.setLeaderboardRows("friend-b", []);
    vi.mocked(fetchMatchStats).mockImplementation(async () => ({
      rounds: [
        {
          teams: [
            {
              players: [{ player_id: "target" }, { player_id: "random" }],
            },
          ],
        },
      ],
    }));

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
            queue: "solo",
          },
        } as any)
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        faceitId: "friend-a",
        gamesPlayed: 1,
        avgKills: 40,
      }),
      expect.objectContaining({
        faceitId: "target",
        gamesPlayed: 1,
        avgKills: 15,
      }),
    ]);
    expect(result.targetMatchCount).toBe(1);
    expect(result.sharedFriendCount).toBe(1);
  });
});
