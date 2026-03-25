import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchAnalyticsScoreboard } from "~/components/MatchAnalyticsScoreboard";
import type { DemoPlayerAnalytics, MatchPlayerStats } from "~/lib/types";

function buildFaceitPlayers(): MatchPlayerStats[] {
  return [
    {
      playerId: "p1",
      nickname: "Alice",
      kills: 25,
      deaths: 12,
      assists: 5,
      headshots: 10,
      mvps: 3,
      kdRatio: 2.08,
      adr: 95,
      hsPercent: 40,
      krRatio: 1.0,
      tripleKills: 1,
      quadroKills: 0,
      pentaKills: 0,
      result: true,
      damage: 1900,
      firstKills: 3,
      entryCount: 4,
      entryWins: 3,
      clutchKills: 1,
      oneV1Count: 1,
      oneV1Wins: 1,
      oneV2Count: 0,
      oneV2Wins: 0,
      doubleKills: 2,
      utilityDamage: 120,
      enemiesFlashed: 6,
      flashCount: 12,
      sniperKills: 5,
      pistolKills: 2,
    },
    {
      playerId: "p2",
      nickname: "Bob",
      kills: 18,
      deaths: 15,
      assists: 7,
      headshots: 8,
      mvps: 2,
      kdRatio: 1.2,
      adr: 78,
      hsPercent: 44,
      krRatio: 0.72,
      tripleKills: 0,
      quadroKills: 0,
      pentaKills: 0,
      result: true,
      damage: 1560,
      firstKills: 1,
      entryCount: 2,
      entryWins: 1,
      clutchKills: 0,
      oneV1Count: 0,
      oneV1Wins: 0,
      oneV2Count: 0,
      oneV2Wins: 0,
      doubleKills: 1,
      utilityDamage: 80,
      enemiesFlashed: 3,
      flashCount: 8,
      sniperKills: 0,
      pistolKills: 1,
    },
    {
      playerId: "p3",
      nickname: "Charlie",
      kills: 14,
      deaths: 18,
      assists: 3,
      headshots: 6,
      mvps: 1,
      kdRatio: 0.78,
      adr: 62,
      hsPercent: 43,
      krRatio: 0.56,
      tripleKills: 0,
      quadroKills: 0,
      pentaKills: 0,
      result: false,
      damage: 1240,
      firstKills: 0,
      entryCount: 1,
      entryWins: 0,
      clutchKills: 0,
      oneV1Count: 0,
      oneV1Wins: 0,
      oneV2Count: 0,
      oneV2Wins: 0,
      doubleKills: 0,
      utilityDamage: 60,
      enemiesFlashed: 2,
      flashCount: 6,
      sniperKills: 1,
      pistolKills: 0,
    },
  ];
}

function buildDemoPlayers(): DemoPlayerAnalytics[] {
  return [
    {
      nickname: "Alice",
      teamKey: "team1",
      tradeKills: 4,
      untradedDeaths: 2,
      rws: 14.5,
      playerId: "p1",
      kills: 25,
      deaths: 12,
      assists: 5,
      adr: 95,
    },
    {
      nickname: "Bob",
      teamKey: "team1",
      tradeKills: 2,
      untradedDeaths: 5,
      rws: 9.8,
      playerId: "p2",
      kills: 18,
      deaths: 15,
      assists: 7,
      adr: 78,
    },
    {
      nickname: "Charlie",
      teamKey: "team2",
      tradeKills: 1,
      untradedDeaths: 8,
      rws: 6.2,
      playerId: "p3",
      kills: 14,
      deaths: 18,
      assists: 3,
      adr: 62,
    },
  ];
}

const teams = {
  faction1: { name: "Alpha", playerIds: ["p1", "p2"] },
  faction2: { name: "Bravo", playerIds: ["p3"] },
};

describe("MatchAnalyticsScoreboard", () => {
  it("renders all player nicknames", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={buildDemoPlayers()}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId={null}
        teams={teams}
      />
    );
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("Charlie");
  });

  it("renders demo-derived columns (trade kills, RWS)", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={buildDemoPlayers()}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId={null}
        teams={teams}
      />
    );
    // Trade kills values
    expect(html).toContain("4");
    // RWS values
    expect(html).toContain("14.5");
  });

  it("sorts players by kills descending within each team", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={buildDemoPlayers()}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId={null}
        teams={teams}
      />
    );
    // Alice (25k) should appear before Bob (18k) in team1
    const aliceIdx = html.indexOf("Alice");
    const bobIdx = html.indexOf("Bob");
    expect(aliceIdx).toBeLessThan(bobIdx);
  });

  it("groups players by team with team name headers", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={buildDemoPlayers()}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId={null}
        teams={teams}
      />
    );
    expect(html).toContain("Alpha");
    expect(html).toContain("Bravo");
  });

  it("highlights the selected player row", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={buildDemoPlayers()}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId="p1"
        teams={teams}
      />
    );
    // Should have a visual distinction for the selected row
    expect(html).toContain("ring-accent");
  });

  it("renders FACEIT-only scoreboard when no demo players provided", () => {
    const html = renderToStaticMarkup(
      <MatchAnalyticsScoreboard
        demoPlayers={[]}
        faceitPlayers={buildFaceitPlayers()}
        onSelectPlayer={() => {}}
        selectedPlayerId={null}
        teams={teams}
      />
    );
    expect(html).toContain("Alice");
    expect(html).toContain("25"); // kills
    expect(html).not.toContain("RWS");
  });
});
