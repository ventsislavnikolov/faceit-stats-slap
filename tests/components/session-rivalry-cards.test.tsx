import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionRivalryCards } from "~/components/last-party/SessionRivalryCards";

const cards = [
  {
    id: "head-to-head",
    title: "Head-to-Head",
    playerIds: ["p1", "p2"],
    summary: "Alice beat Bob 2-1",
    evidence: ["3 shared maps", "16.4 average margin"],
  },
  {
    id: "closest-duel",
    title: "Closest Duel",
    playerIds: ["p2", "p3"],
    summary: "Bob vs Cara was 1-1",
    evidence: ["2 shared maps"],
  },
] as const;

describe("SessionRivalryCards", () => {
  it("renders rivalry summaries and evidence", () => {
    const html = renderToStaticMarkup(
      <SessionRivalryCards cards={cards as any} />
    );

    expect(html).toContain("Session Rivalries");
    expect(html).toContain("Head-to-Head");
    expect(html).toContain("Alice beat Bob 2-1");
    expect(html).toContain("3 shared maps");
    expect(html).toContain("Closest Duel");
    expect(html).toContain("Bob vs Cara was 1-1");
  });
});
