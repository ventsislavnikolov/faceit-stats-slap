import { describe, expect, it } from "vitest";
import {
  computeAggregateStats,
  computeAwards,
  computeMapDistribution,
  computeSessionStreak,
  buildSessionRivalries,
} from "~/lib/last-party";
import type {
  AggregatePlayerStats,
  MatchPlayerStats,
  PlayerHistoryMatch,
  PartySessionData,
} from "~/lib/types";

const makePlayer = (
  overrides: Partial<MatchPlayerStats> & { playerId: string; nickname: string }
): MatchPlayerStats => ({
  adr: 80,
  assists: 3,
  clutchKills: 0,
  damage: 1600,
  deaths: 15,
  doubleKills: 0,
  enemiesFlashed: 2,
  entryCount: 3,
  entryWins: 1,
  firstKills: 1,
  flashCount: 5,
  headshots: 8,
  hsPercent: 50,
  kdRatio: 1.0,
  kills: 15,
  krRatio: 0.6,
  mvps: 2,
  oneV1Count: 0,
  oneV1Wins: 0,
  oneV2Count: 0,
  oneV2Wins: 0,
  pentaKills: 0,
  pistolKills: 1,
  quadroKills: 0,
  result: true,
  sniperKills: 0,
  tripleKills: 0,
  utilityDamage: 50,
  ...overrides,
});

const makeSessionMatch = (
  overrides: Partial<PlayerHistoryMatch> & {
    matchId: string;
    map: string;
    startedAt: number;
  }
): PlayerHistoryMatch => ({
  adr: 80,
  assists: 3,
  clutchKills: 0,
  damage: 1600,
  deaths: 15,
  doubleKills: 0,
  enemiesFlashed: 2,
  entryCount: 3,
  entryWins: 1,
  firstKills: 1,
  flashCount: 5,
  headshots: 8,
  hsPercent: 50,
  kdRatio: 1.0,
  kills: 15,
  krRatio: 0.6,
  knownQueuedFriendCount: 2,
  knownQueuedFriendIds: ["p2", "p3"],
  map: "de_inferno",
  matchId: "match-1",
  mvps: 2,
  oneV1Count: 0,
  oneV1Wins: 0,
  oneV2Count: 0,
  oneV2Wins: 0,
  partySize: 3,
  pentaKills: 0,
  pistolKills: 1,
  playerId: "p1",
  queueBucket: "party",
  quadroKills: 0,
  result: true,
  score: "13-8",
  sniperKills: 0,
  startedAt: 1,
  tripleKills: 0,
  utilityDamage: 50,
  finishedAt: 2,
  hasDemoAnalytics: false,
  ...overrides,
});

const makeAggregatePlayer = (
  overrides: Partial<AggregatePlayerStats> & {
    faceitId: string;
    nickname: string;
  }
): AggregatePlayerStats => ({
  avgAdr: 80,
  avgHsPercent: 50,
  avgImpact: 10,
  avgKd: 1,
  avgKrRatio: 0.6,
  faceitId: "p1",
  gamesPlayed: 3,
  nickname: "Alice",
  totalMvps: 2,
  totalPentaKills: 0,
  totalQuadroKills: 0,
  totalTripleKills: 0,
  wins: 2,
  ...overrides,
});

describe("computeAggregateStats", () => {
  it("averages stats across matches for a player", () => {
    const matchStats: Record<string, MatchPlayerStats[]> = {
      match1: [
        makePlayer({
          playerId: "p1",
          nickname: "Alice",
          kills: 20,
          kdRatio: 1.5,
          adr: 90,
        }),
      ],
      match2: [
        makePlayer({
          playerId: "p1",
          nickname: "Alice",
          kills: 10,
          kdRatio: 0.5,
          adr: 70,
        }),
      ],
    };
    const result = computeAggregateStats({
      matchIds: ["match1", "match2"],
      matchStats,
      partyMemberIds: ["p1"],
      demoMatches: {},
      allHaveDemo: false,
    });
    expect(result.p1.avgKd).toBeCloseTo(1.0);
    expect(result.p1.avgAdr).toBeCloseTo(80);
    expect(result.p1.gamesPlayed).toBe(2);
    expect(result.p1.avgImpact).toBeGreaterThan(0);
  });
});

describe("computeAwards", () => {
  it("picks MVP as highest avg K/D", () => {
    const stats: Record<string, any> = {
      p1: {
        faceitId: "p1",
        nickname: "Alice",
        avgKd: 1.5,
        avgAdr: 80,
        avgHsPercent: 50,
        gamesPlayed: 2,
        wins: 1,
      },
      p2: {
        faceitId: "p2",
        nickname: "Bob",
        avgKd: 0.8,
        avgAdr: 90,
        avgHsPercent: 60,
        gamesPlayed: 2,
        wins: 1,
      },
    };
    const awards = computeAwards({
      aggregateStats: stats,
      allHaveDemo: false,
      mapDistribution: [],
      playerId: "p1",
      date: "2026-03-25",
    });
    const mvp = awards.find((a) => a.id === "party-mvp");
    expect(mvp?.recipient).toBe("Alice");
    const anchor = awards.find((a) => a.id === "party-anchor");
    expect(anchor?.recipient).toBe("Bob");
  });

  it("picks Damage Dealer as highest ADR", () => {
    const stats: Record<string, any> = {
      p1: {
        faceitId: "p1",
        nickname: "Alice",
        avgKd: 1.0,
        avgAdr: 70,
        avgHsPercent: 50,
        gamesPlayed: 2,
        wins: 1,
      },
      p2: {
        faceitId: "p2",
        nickname: "Bob",
        avgKd: 1.0,
        avgAdr: 95,
        avgHsPercent: 40,
        gamesPlayed: 2,
        wins: 1,
      },
    };
    const awards = computeAwards({
      aggregateStats: stats,
      allHaveDemo: false,
      mapDistribution: [],
      playerId: "p1",
      date: "2026-03-25",
    });
    const dd = awards.find((a) => a.id === "damage-dealer");
    expect(dd?.recipient).toBe("Bob");
  });
});

describe("computeMapDistribution", () => {
  it("counts maps and win rates", () => {
    const matches = [
      { map: "de_inferno", result: true },
      { map: "de_inferno", result: false },
      { map: "de_dust2", result: true },
    ] as any[];
    const result = computeMapDistribution(matches);
    const inferno = result.find((m) => m.map === "de_inferno");
    expect(inferno?.gamesPlayed).toBe(2);
    expect(inferno?.winRate).toBe(50);
    const dust2 = result.find((m) => m.map === "de_dust2");
    expect(dust2?.wins).toBe(1);
  });
});

describe("computeSessionStreak", () => {
  it("returns zero streak for empty matches", () => {
    expect(computeSessionStreak([])).toEqual({ type: "win", count: 0 });
  });

  it("counts longest win streak", () => {
    const matches = [
      { result: true, startedAt: 1 },
      { result: true, startedAt: 2 },
      { result: false, startedAt: 3 },
      { result: true, startedAt: 4 },
    ] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "win", count: 2 });
  });

  it("counts longest loss streak", () => {
    const matches = [
      { result: true, startedAt: 1 },
      { result: false, startedAt: 2 },
      { result: false, startedAt: 3 },
      { result: false, startedAt: 4 },
    ] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "loss", count: 3 });
  });

  it("handles single match", () => {
    const matches = [{ result: true, startedAt: 1 }] as any[];
    expect(computeSessionStreak(matches)).toEqual({ type: "win", count: 1 });
  });
});

describe("rivalry session types", () => {
  it("exposes rivalry fields on session and aggregate shapes", () => {
    const _sessionRivalries: PartySessionData["rivalries"] = undefined;
    const _sessionScore: AggregatePlayerStats["sessionScore"] = undefined;
    const _scoreBreakdown: AggregatePlayerStats["scoreBreakdown"] = undefined;
    void [_sessionRivalries, _sessionScore, _scoreBreakdown];
  });
});

describe("buildSessionRivalries", () => {
  it("ranks the podium by session score", () => {
    const aggregateStats = {
      p1: makeAggregatePlayer({
        faceitId: "p1",
        nickname: "Alice",
        avgImpact: 20,
        avgKd: 1.8,
        avgAdr: 95,
        avgHsPercent: 60,
        wins: 3,
      }),
      p2: makeAggregatePlayer({
        faceitId: "p2",
        nickname: "Bob",
        avgImpact: 15,
        avgKd: 1.4,
        avgAdr: 85,
        avgHsPercent: 50,
        wins: 2,
      }),
      p3: makeAggregatePlayer({
        faceitId: "p3",
        nickname: "Cara",
        avgImpact: 10,
        avgKd: 1.1,
        avgAdr: 75,
        avgHsPercent: 45,
        wins: 1,
      }),
    };
    const matches = [
      makeSessionMatch({
        matchId: "match-1",
        map: "de_inferno",
        startedAt: 1,
      }),
      makeSessionMatch({
        matchId: "match-2",
        map: "de_mirage",
        startedAt: 2,
      }),
      makeSessionMatch({
        matchId: "match-3",
        map: "de_nuke",
        startedAt: 3,
      }),
    ];
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match-1": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 25, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 20, result: false }),
        makePlayer({ playerId: "p3", nickname: "Cara", kills: 15, result: false }),
      ],
      "match-2": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 18, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 22, result: true }),
        makePlayer({ playerId: "p3", nickname: "Cara", kills: 10, result: false }),
      ],
      "match-3": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 24, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 19, result: false }),
        makePlayer({ playerId: "p3", nickname: "Cara", kills: 12, result: false }),
      ],
    };

    const result = buildSessionRivalries({
      aggregateStats,
      allHaveDemo: false,
      matchStats,
      matches,
    });

    expect(result.podium.map((entry) => entry.nickname)).toEqual([
      "Alice",
      "Bob",
      "Cara",
    ]);
    expect(result.podium[0]?.sessionScore).toBeGreaterThan(
      result.podium[1]?.sessionScore ?? 0
    );
  });

  it("builds head-to-head evidence from shared session maps only", () => {
    const aggregateStats = {
      p1: makeAggregatePlayer({
        faceitId: "p1",
        nickname: "Alice",
        avgImpact: 18,
        avgKd: 1.5,
        avgAdr: 90,
        wins: 3,
      }),
      p2: makeAggregatePlayer({
        faceitId: "p2",
        nickname: "Bob",
        avgImpact: 16,
        avgKd: 1.3,
        avgAdr: 84,
        wins: 2,
      }),
    };
    const matches = [
      makeSessionMatch({ matchId: "match-1", map: "de_inferno", startedAt: 1 }),
      makeSessionMatch({ matchId: "match-2", map: "de_mirage", startedAt: 2 }),
      makeSessionMatch({ matchId: "match-3", map: "de_nuke", startedAt: 3 }),
      makeSessionMatch({
        matchId: "match-4",
        map: "de_ancient",
        startedAt: 4,
        knownQueuedFriendIds: [],
      }),
    ];
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match-1": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 25, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 20, result: false }),
      ],
      "match-2": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 18, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 22, result: true }),
      ],
      "match-3": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 24, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 19, result: false }),
      ],
      "match-4": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 11, result: false }),
      ],
    };

    const result = buildSessionRivalries({
      aggregateStats,
      allHaveDemo: false,
      matchStats,
      matches,
    });

    const headToHead = result.rivalryCards.find(
      (card) => card.id === "head-to-head"
    );
    expect(headToHead?.playerIds).toEqual(["p1", "p2"]);
    expect(headToHead?.summary).toContain("2-1");
    expect(headToHead?.evidence.join(" ")).toContain("3 shared maps");
  });

  it("attributes the wide-gap card to the actual winner", () => {
    const aggregateStats = {
      p1: makeAggregatePlayer({
        faceitId: "p1",
        nickname: "Alice",
        avgImpact: 12,
        avgKd: 1.0,
        avgAdr: 72,
        wins: 1,
      }),
      p2: makeAggregatePlayer({
        faceitId: "p2",
        nickname: "Bob",
        avgImpact: 19,
        avgKd: 1.7,
        avgAdr: 91,
        wins: 3,
      }),
    };
    const matches = [
      makeSessionMatch({ matchId: "match-1", map: "de_inferno", startedAt: 1 }),
      makeSessionMatch({ matchId: "match-2", map: "de_mirage", startedAt: 2 }),
      makeSessionMatch({ matchId: "match-3", map: "de_nuke", startedAt: 3 }),
    ];
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match-1": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 24, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 20, result: false }),
      ],
      "match-2": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 18, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 26, result: true }),
      ],
      "match-3": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 16, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 28, result: true }),
      ],
    };

    const result = buildSessionRivalries({
      aggregateStats,
      allHaveDemo: false,
      matchStats,
      matches,
    });

    const wideGap = result.rivalryCards.find((card) => card.id === "wide-gap");
    expect(wideGap?.summary).toContain("Bob");
    expect(wideGap?.evidence.join(" ")).toContain("2-1");
  });

  it("ignores demo ratings when demo coverage is partial", () => {
    const aggregateStats = {
      p1: makeAggregatePlayer({
        faceitId: "p1",
        nickname: "Alice",
        avgImpact: 12,
        avgKd: 1.0,
        avgAdr: 68,
        avgRating: 2.5,
        wins: 1,
      }),
      p2: makeAggregatePlayer({
        faceitId: "p2",
        nickname: "Bob",
        avgImpact: 18,
        avgKd: 1.6,
        avgAdr: 88,
        avgRating: 0.5,
        wins: 3,
      }),
    };
    const matches = [
      makeSessionMatch({ matchId: "match-1", map: "de_inferno", startedAt: 1 }),
      makeSessionMatch({ matchId: "match-2", map: "de_mirage", startedAt: 2 }),
    ];
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match-1": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 15, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 20, result: true }),
      ],
      "match-2": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 12, result: false }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 22, result: true }),
      ],
    };

    const result = buildSessionRivalries({
      aggregateStats,
      allHaveDemo: false,
      matchStats,
      matches,
    });

    expect(result.podium[0]?.nickname).toBe("Bob");
    expect(result.podium[0]?.sessionScore).toBeGreaterThan(
      result.podium[1]?.sessionScore ?? 0
    );
  });

  it("breaks ties alphabetically", () => {
    const aggregateStats = {
      p1: makeAggregatePlayer({
        faceitId: "p1",
        nickname: "Alice",
        avgImpact: 15,
        avgKd: 1.3,
        avgAdr: 82,
        wins: 2,
      }),
      p2: makeAggregatePlayer({
        faceitId: "p2",
        nickname: "Bob",
        avgImpact: 15,
        avgKd: 1.3,
        avgAdr: 82,
        wins: 2,
      }),
    };
    const matches = [
      makeSessionMatch({ matchId: "match-1", map: "de_inferno", startedAt: 1 }),
    ];
    const matchStats: Record<string, MatchPlayerStats[]> = {
      "match-1": [
        makePlayer({ playerId: "p1", nickname: "Alice", kills: 18, result: true }),
        makePlayer({ playerId: "p2", nickname: "Bob", kills: 18, result: true }),
      ],
    };

    const result = buildSessionRivalries({
      aggregateStats,
      allHaveDemo: false,
      matchStats,
      matches,
    });

    expect(result.podium.map((entry) => entry.nickname)).toEqual([
      "Alice",
      "Bob",
    ]);
  });
});
