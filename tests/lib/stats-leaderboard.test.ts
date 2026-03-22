import { describe, expect, it } from "vitest";
import {
  buildSharedStatsLeaderboard,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";

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
});
