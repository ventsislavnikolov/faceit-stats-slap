import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HistoryMatchesTable } from "~/components/HistoryMatchesTable";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe("HistoryMatchesTable", () => {
  it("shows kills and removes the redundant player column", () => {
    const html = renderToStaticMarkup(
      <HistoryMatchesTable
        matches={[
          {
            nickname: "soavarice",
            matchId: "match-1",
            map: "de_inferno",
            score: "13 / 7",
            kills: 21,
            kdRatio: 1.4,
            krRatio: 0.82,
            adr: 88,
            hsPercent: 47,
            result: true,
            queueBucket: "party",
          },
        ]}
      />
    );

    expect(html).toContain("Kills");
    expect(html).toContain(">21<");
    expect(html).toContain("K/R");
    expect(html).toContain(">0.82<");
    expect(html).not.toContain("Player");
  });

  it("uses the normalized loaded-state grid width", () => {
    const html = renderToStaticMarkup(
      <HistoryMatchesTable
        matches={[
          {
            nickname: "soavarice",
            matchId: "match-1",
            map: "de_inferno",
            score: "13 / 7",
            kills: 21,
            kdRatio: 1.4,
            krRatio: 0.82,
            adr: 88,
            hsPercent: 47,
            result: true,
            queueBucket: "party",
          },
        ]}
      />
    );

    expect(html).toContain(
      "grid-template-columns:3rem 24rem 2.5rem repeat(7, 5rem)"
    );
  });
});
