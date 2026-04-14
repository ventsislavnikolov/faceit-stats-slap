import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SessionStatsTable,
  SessionStatsTableView,
} from "~/components/last-party/SessionStatsTable";
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
  },
};

describe("SessionStatsTable", () => {
  it("renders a session impact column and sorts rows by session score", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTable allHaveDemo={false} stats={stats} />
    );

    expect(html).toContain("Session Impact");
    expect(html).not.toContain(">Impact<");
    expect(html.indexOf("Alice")).toBeLessThan(html.indexOf("Bob"));
    expect(html).toContain("91.4");
    expect(html).toContain("82.6");
  });

  it("does not render a score breakdown toggle or expanded section", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTableView
        allHaveDemo={false}
        entries={Object.values(stats)}
      />
    );

    expect(html).not.toContain("Score breakdown");
    expect(html).not.toContain("Hide score breakdown");
    expect(html).not.toContain("Best map");
  });

  it("renders demo-only columns when allHaveDemo is true", () => {
    const html = renderToStaticMarkup(
      <SessionStatsTableView
        allHaveDemo={true}
        entries={[
          {
            ...stats.p1,
            avgRating: 1.28,
            avgRws: 15.4,
            avgKast: 72,
            avgTradeKills: 1.8,
            avgUtilityDamage: 34,
            avgEntryRate: 0.56,
          },
        ]}
      />
    );

    expect(html).toContain("RTG");
    expect(html).toContain("Entry%");
  });
});
