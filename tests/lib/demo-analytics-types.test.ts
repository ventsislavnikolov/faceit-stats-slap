import { describe, expect, it } from "vitest";
import type {
  DemoAnalyticsAvailability,
  DemoAnalyticsSourceType,
  DemoIngestionStatus,
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  DemoTeamKey,
  MatchDetailWithDemoAnalytics,
} from "~/lib/types";
import {
  DEMO_ANALYTICS_AVAILABILITY_VALUES,
  DEMO_ANALYTICS_SOURCE_TYPE_VALUES,
  DEMO_INGESTION_STATUS_VALUES,
} from "~/lib/types";

describe("demo analytics contracts", () => {
  it("exposes the ingestion lifecycle values", () => {
    const statuses = DEMO_INGESTION_STATUS_VALUES satisfies readonly DemoIngestionStatus[];

    expect(statuses).toEqual([
      "queued",
      "parsing",
      "parsed",
      "failed",
      "source_unavailable",
    ]);
  });

  it("exposes the source and availability values", () => {
    const sourceValues = DEMO_ANALYTICS_SOURCE_TYPE_VALUES satisfies readonly DemoAnalyticsSourceType[];
    const availabilityValues =
      DEMO_ANALYTICS_AVAILABILITY_VALUES satisfies readonly DemoAnalyticsAvailability[];

    expect(sourceValues).toEqual(["faceit_demo_url", "manual_upload"]);
    expect(availabilityValues).toEqual(["available", "unavailable"]);
  });

  it("types a demo player analytics row with the shared team key", () => {
    const teamKey = "team1" satisfies DemoTeamKey;
    const player = {
      nickname: "TibaBG",
      teamKey,
      tradeKills: 3,
      untradedDeaths: 4,
      rws: 13.8,
    } satisfies DemoPlayerAnalytics;

    expect(player.teamKey).toBe("team1");
  });

  it("types a demo team analytics row with the shared team key", () => {
    const teamKey = "team1" satisfies DemoTeamKey;
    const team = {
      teamKey,
      name: "Team One",
      side: "CT",
      roundsWon: 13,
      roundsLost: 11,
      tradeKills: 7,
      untradedDeaths: 9,
      rws: 13.2,
    } satisfies DemoTeamAnalytics;

    expect(team.teamKey).toBe("team1");
  });

  it("types a round analytics row with team-scoped score state", () => {
    const teamKey = "team1" satisfies DemoTeamKey;
    const round = {
      roundNumber: 17,
      winnerTeamKey: teamKey,
      winnerSide: "CT",
      isPistolRound: false,
      isBombRound: true,
      scoreAfterRound: { team1: 10, team2: 7 },
    } satisfies DemoRoundAnalytics;

    expect(round.scoreAfterRound.team1).toBe(10);
    expect(round.scoreAfterRound.team2).toBe(7);
  });

  it("types a match analytics payload without UI formatting fields", () => {
    const teamKey = "team1" satisfies DemoTeamKey;
    const player = {
      nickname: "TibaBG",
      teamKey,
      tradeKills: 3,
      untradedDeaths: 4,
      rws: 13.8,
    } satisfies DemoPlayerAnalytics;

    const team = {
      teamKey,
      name: "Team One",
      side: "CT",
      roundsWon: 13,
      roundsLost: 11,
      tradeKills: 7,
      untradedDeaths: 9,
      rws: 13.2,
    } satisfies DemoTeamAnalytics;

    const round = {
      roundNumber: 17,
      winnerTeamKey: teamKey,
      winnerSide: "CT",
      isPistolRound: false,
      isBombRound: true,
      scoreAfterRound: { team1: 10, team2: 7 },
    } satisfies DemoRoundAnalytics;

    const matchAnalytics = {
      matchId: "match-1",
      sourceType: "faceit_demo_url",
      availability: "available",
      ingestionStatus: "parsed",
      mapName: "de_inferno",
      totalRounds: 24,
      rounds: [round],
      teams: [team],
      players: [player],
    } satisfies DemoMatchAnalytics;

    expect(matchAnalytics).toMatchObject({
      matchId: "match-1",
      sourceType: "faceit_demo_url",
      availability: "available",
      ingestionStatus: "parsed",
      mapName: "de_inferno",
      totalRounds: 24,
    });
    expect(matchAnalytics.players).toHaveLength(1);
    expect(matchAnalytics.rounds).toHaveLength(1);
  });

  it("types the match detail wrapper without mirroring demo state", () => {
    const matchDetail = {
      matchId: "match-1",
      map: "de_inferno",
      score: "13 / 11",
      status: "FINISHED",
      startedAt: 1711363200000,
      finishedAt: 1711366800000,
      players: [],
      demoUrl: "https://example.com/match.dem",
      teams: {
        faction1: { name: "Team One", score: 13, playerIds: ["p1"] },
        faction2: { name: "Team Two", score: 11, playerIds: ["p2"] },
      },
      rounds: 24,
      region: "EU",
      competitionName: "Ranked",
      demoAnalytics: {
        matchId: "match-1",
        sourceType: "faceit_demo_url",
        availability: "available",
        ingestionStatus: "parsed",
        mapName: "de_inferno",
        totalRounds: 24,
        rounds: [],
        teams: [],
        players: [],
      },
    } satisfies MatchDetailWithDemoAnalytics;

    expect(matchDetail.demoAnalytics?.ingestionStatus).toBe("parsed");
    expect(matchDetail).not.toHaveProperty("demoIngestionStatus");
    expect(matchDetail).not.toHaveProperty("demoAnalyticsSourceType");
  });
});
