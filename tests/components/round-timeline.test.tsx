import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoundTimeline } from "~/components/RoundTimeline";
import type { DemoRoundAnalytics } from "~/lib/types";

function buildRounds(count = 20): DemoRoundAnalytics[] {
  return Array.from({ length: count }, (_, i) => ({
    roundNumber: i + 1,
    winnerTeamKey: (i < 12 ? "team1" : "team2") as "team1" | "team2",
    winnerSide: (i < 12 ? "CT" : "T") as "CT" | "T",
    isPistolRound: i === 0 || i === 12,
    isBombRound: i % 3 === 0,
    scoreAfterRound: {
      team1: Math.min(i + 1, 13),
      team2: i < 12 ? 0 : i - 11,
    },
  }));
}

describe("RoundTimeline", () => {
  it("renders exactly 20 round markers", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    // Each round should have a round number marker
    for (let i = 1; i <= 20; i++) {
      expect(html).toContain(`>${i}<`);
    }
  });

  it("marks pistol rounds distinctly", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    // Pistol rounds (1 and 13) should have a visual marker
    expect(html).toContain("pistol");
  });

  it("shows team names", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    expect(html).toContain("Alpha");
    expect(html).toContain("Bravo");
  });

  it("visually distinguishes team1 and team2 wins", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    // team1 wins should use accent color, team2 should use a different one
    expect(html).toContain("bg-accent");
    expect(html).toContain("bg-error");
  });

  it("shows score progression", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    // Final score should be visible
    expect(html).toContain("13");
  });

  it("renders half separator at round 12/13 boundary", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline
        rounds={buildRounds(20)}
        team1Name="Alpha"
        team2Name="Bravo"
      />
    );
    expect(html).toContain("half");
  });

  it("handles empty rounds gracefully", () => {
    const html = renderToStaticMarkup(
      <RoundTimeline rounds={[]} team1Name="Alpha" team2Name="Bravo" />
    );
    expect(html).toContain("No rounds");
  });
});
