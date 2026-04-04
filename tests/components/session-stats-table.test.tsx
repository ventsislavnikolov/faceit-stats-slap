import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionStatsTable } from "~/components/last-party/SessionStatsTable";
import type { AggregatePlayerStats } from "~/lib/types";

const stats: Record<string, AggregatePlayerStats> = {
  p1: {
    faceitId: "p1",
    nickname: "Alice",
    avgAdr: 88,
    avgHsPercent: 54,
    avgImpact: 18.2,
    avgKd: 1.45,
    avgKrRatio: 0.74,
    gamesPlayed: 4,
    totalMvps: 6,
    totalPentaKills: 0,
    totalQuadroKills: 1,
    totalTripleKills: 2,
    wins: 3,
    sessionScore: 91.4,
    bestMapId: "match-2",
    worstMapId: "match-4",
    scoreBreakdown: {
      sessionScore: 91.4,
      strongestReasons: ["Impact", "Win rate"],
      weakestCategory: "HS%",
      categories: [
        { key: "avgImpact", label: "Impact", score: 98, weight: 4 },
        { key: "winRate", label: "Win rate", score: 92, weight: 4 },
      ],
    },
  },
  p2: {
    faceitId: "p2",
    nickname: "Bob",
    avgAdr: 79,
    avgHsPercent: 48,
    avgImpact: 16.1,
    avgKd: 1.22,
    avgKrRatio: 0.69,
    gamesPlayed: 4,
    totalMvps: 4,
    totalPentaKills: 0,
    totalQuadroKills: 0,
    totalTripleKills: 1,
    wins: 2,
    sessionScore: 82.6,
    scoreBreakdown: {
      sessionScore: 82.6,
      strongestReasons: ["ADR"],
      weakestCategory: "K/D",
      categories: [{ key: "avgAdr", label: "ADR", score: 88, weight: 3 }],
    },
  },
};

describe("SessionStatsTable", () => {
  it("renders a session score column and sorts rows by session score", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTable allHaveDemo={false} stats={stats} />
    );

    expect(html).toContain("Session Score");
    expect(html.indexOf("Alice")).toBeLessThan(html.indexOf("Bob"));
    expect(html).toContain("91.4");
    expect(html).toContain("82.6");
  });

  it("renders breakdown evidence for players with a score breakdown", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTable allHaveDemo={false} stats={stats} />
    );

    expect(html).toContain("Strong:");
    expect(html).toContain("Impact");
    expect(html).toContain("Win rate");
    expect(html).toContain("Weak:");
    expect(html).toContain("HS%");
    expect(html).toContain("Best map");
    expect(html).toContain("Worst map");
  });

  it("keeps the breakdown row aligned when demo columns are shown", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTable
        allHaveDemo={true}
        stats={{
          p1: {
            ...stats.p1,
            avgRating: 1.28,
            avgRws: 15.4,
            avgKast: 72,
            avgTradeKills: 1.8,
            avgUtilityDamage: 34,
            avgEntryRate: 0.56,
          },
        }}
      />
    );

    expect(html).toContain("RTG");
    expect(html).toContain("Entry%");
    expect(html).toContain('colSpan="16"');
  });
});
