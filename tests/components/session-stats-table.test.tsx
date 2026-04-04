import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SessionStatsTable,
  SessionStatsTableView,
  toggleExpandedPlayerId,
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

function getTextContent(node: unknown): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join(" ");
  }

  if (typeof node === "object" && "props" in node) {
    return getTextContent(
      (node as { props?: { children?: unknown } }).props?.children
    );
  }

  return "";
}

function findButtonByLabel(node: unknown, label: string): any | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const element = node as {
    props?: { children?: unknown; onClick?: () => void };
    type?: string;
  };

  if (
    element.type === "button" &&
    getTextContent(element.props?.children).includes(label)
  ) {
    return element;
  }

  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findButtonByLabel(child, label);
      if (match) {
        return match;
      }
    }
  } else if (children) {
    return findButtonByLabel(children, label);
  }

  return null;
}

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

  it("toggles the evidence drawer per player row", () => {
    expect(toggleExpandedPlayerId(null, "p1")).toBe("p1");
    expect(toggleExpandedPlayerId("p1", "p1")).toBeNull();

    const onToggleExpandedPlayer = vi.fn();

    const collapsedView = SessionStatsTableView({
      allHaveDemo: false,
      entries: Object.values(stats),
      expandedPlayerId: null,
      onToggleExpandedPlayer,
    });

    const collapseButton = findButtonByLabel(collapsedView, "Score breakdown");

    expect(collapseButton).not.toBeNull();
    expect(collapseButton?.props["aria-expanded"]).toBe(false);
    expect(getTextContent(collapsedView)).not.toContain("Strong:");
    expect(getTextContent(collapsedView)).not.toContain("Best map");

    collapseButton?.props.onClick?.();

    expect(onToggleExpandedPlayer).toHaveBeenCalledWith("p1");

    const expandedView = SessionStatsTableView({
      allHaveDemo: false,
      entries: Object.values(stats),
      expandedPlayerId: "p1",
      onToggleExpandedPlayer,
    });

    const expandedButton = findButtonByLabel(
      expandedView,
      "Hide score breakdown"
    );

    expect(expandedButton).not.toBeNull();
    expect(expandedButton?.props["aria-expanded"]).toBe(true);
    const expandedHtml = renderToStaticMarkup(expandedView);

    expect(expandedHtml).toContain("Strong:");
    expect(expandedHtml).toContain("Impact");
    expect(expandedHtml).toContain("Win rate");
    expect(expandedHtml).toContain("Weak:");
    expect(expandedHtml).toContain("HS%");
    expect(expandedHtml).toContain("Best map");
    expect(expandedHtml).toContain("Worst map");
  });

  it("keeps the breakdown row aligned when demo columns are shown", () => {
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
        expandedPlayerId="p1"
        onToggleExpandedPlayer={() => {}}
      />
    );

    expect(html).toContain("RTG");
    expect(html).toContain("Entry%");
    expect(html).toContain('colSpan="16"');
  });
});
