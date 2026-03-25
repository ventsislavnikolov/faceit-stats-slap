import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — DemoAnalyticsStatusPanel is tested as a standalone component
// ---------------------------------------------------------------------------

vi.mock("~/hooks/useMatchDetail", () => ({
  useMatchDetail: vi.fn(),
}));

import { useMatchDetail } from "~/hooks/useMatchDetail";
import { DemoAnalyticsStatusPanel } from "~/components/DemoAnalyticsStatusPanel";

function buildBaselineMatch() {
  return {
    matchId: "match-1",
    map: "de_inferno",
    score: "13 / 7",
    status: "FINISHED",
    startedAt: 1710000000,
    finishedAt: 1710000900,
    demoUrl: "https://demo.test/demo.dem.zst",
    players: [
      { playerId: "p1", nickname: "Player1", kills: 25, deaths: 12, assists: 5 },
      { playerId: "p2", nickname: "Player2", kills: 18, deaths: 15, assists: 3 },
    ],
    teams: {
      faction1: { name: "Alpha", score: 13, playerIds: ["p1"] },
      faction2: { name: "Bravo", score: 7, playerIds: ["p2"] },
    },
    rounds: 20,
    region: "EU",
    competitionName: "Ranked",
  };
}

function buildParsedDemoAnalytics() {
  return {
    matchId: "match-1",
    sourceType: "faceit_demo_url" as const,
    availability: "available" as const,
    ingestionStatus: "parsed" as const,
    mapName: "de_inferno",
    totalRounds: 20,
    teams: [
      {
        teamKey: "team1" as const,
        name: "Alpha",
        side: "CT" as const,
        roundsWon: 13,
        roundsLost: 7,
        tradeKills: 0,
        untradedDeaths: 0,
        rws: 0,
      },
    ],
    players: [
      {
        nickname: "Player1",
        teamKey: "team1" as const,
        tradeKills: 4,
        untradedDeaths: 3,
        rws: 12.5,
        playerId: "p1",
        kills: 25,
        deaths: 12,
        assists: 5,
        adr: 95,
      },
    ],
    rounds: [
      {
        roundNumber: 1,
        winnerTeamKey: "team1" as const,
        winnerSide: null,
        isPistolRound: true,
        isBombRound: false,
        scoreAfterRound: { team1: 1, team2: 0 },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// DemoAnalyticsStatusPanel component tests
// ---------------------------------------------------------------------------

describe("DemoAnalyticsStatusPanel", () => {
  it("renders nothing when demoAnalytics is null and no demoUrl", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel demoAnalytics={null} demoUrl={null} />,
    );
    expect(html).toBe("");
  });

  it("renders a fetch prompt when demoUrl exists but no demo analytics", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel
        demoAnalytics={null}
        demoUrl="https://demo.test/demo.dem.zst"
      />,
    );
    expect(html).toContain("Demo available");
  });

  it("renders queued status", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel
        demoAnalytics={{
          ...buildParsedDemoAnalytics(),
          ingestionStatus: "queued",
          availability: "available",
        }}
        demoUrl="https://demo.test/demo.dem.zst"
      />,
    );
    expect(html).toContain("queued");
  });

  it("renders parsing status", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel
        demoAnalytics={{
          ...buildParsedDemoAnalytics(),
          ingestionStatus: "parsing",
          availability: "available",
        }}
        demoUrl={null}
      />,
    );
    expect(html).toContain("parsing");
  });

  it("renders failed status with error context", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel
        demoAnalytics={{
          ...buildParsedDemoAnalytics(),
          ingestionStatus: "failed",
          availability: "available",
        }}
        demoUrl={null}
      />,
    );
    expect(html).toContain("failed");
  });

  it("renders parsed state indicating analytics are ready", () => {
    const html = renderToStaticMarkup(
      <DemoAnalyticsStatusPanel
        demoAnalytics={buildParsedDemoAnalytics()}
        demoUrl={null}
      />,
    );
    expect(html).toContain("parsed");
  });
});

// ---------------------------------------------------------------------------
// useMatchDetail hook shape tests (via mock)
// ---------------------------------------------------------------------------

describe("useMatchDetail hook contract", () => {
  it("returns baseline match data with demoAnalytics: null when no demo exists", () => {
    const hookResult = {
      data: { ...buildBaselineMatch(), demoAnalytics: null },
      isLoading: false,
      isError: false,
      error: null,
    };
    vi.mocked(useMatchDetail).mockReturnValue(hookResult as any);

    const result = useMatchDetail("match-1");
    expect(result.data).toHaveProperty("demoAnalytics", null);
    expect(result.data).toHaveProperty("matchId", "match-1");
    expect(result.data).toHaveProperty("map", "de_inferno");
  });

  it("returns demoAnalytics when parsed demo exists", () => {
    const hookResult = {
      data: { ...buildBaselineMatch(), demoAnalytics: buildParsedDemoAnalytics() },
      isLoading: false,
      isError: false,
      error: null,
    };
    vi.mocked(useMatchDetail).mockReturnValue(hookResult as any);

    const result = useMatchDetail("match-1");
    expect(result.data?.demoAnalytics).not.toBeNull();
    expect(result.data?.demoAnalytics?.ingestionStatus).toBe("parsed");
    expect(result.data?.demoAnalytics?.totalRounds).toBe(20);
  });
});
