import { describe, expect, it } from "vitest";
import {
  computeAggregateStats,
  computeAwards,
  computeMapDistribution,
  computeSessionStreak,
} from "~/lib/last-party";
import type {
  AggregatePlayerStats,
  MatchPlayerStats,
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
