import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionPodium } from "~/components/last-party/SessionPodium";

const podium = [
  {
    badge: "Carry",
    faceitId: "p1",
    nickname: "Alice",
    rank: 1,
    sessionScore: 94.2,
    verdict: "Impact over consistency",
  },
  {
    badge: "Closer",
    faceitId: "p2",
    nickname: "Bob",
    rank: 2,
    sessionScore: 82.6,
    verdict: "Win rate over ADR",
  },
  {
    badge: "Balanced",
    faceitId: "p3",
    nickname: "Cara",
    rank: 3,
    sessionScore: 77.1,
    verdict: "Steady session",
  },
] as const;

describe("SessionPodium", () => {
  it("renders the top three podium entries with badges and verdicts", () => {
    const html = renderToStaticMarkup(
      <SessionPodium entries={podium as any} />
    );

    expect(html).toContain("Session Podium");
    expect(html).toContain("1");
    expect(html).toContain("Alice");
    expect(html).toContain("94.2");
    expect(html).toContain("Carry");
    expect(html).toContain("Impact over consistency");
    expect(html).toContain("Bob");
    expect(html).toContain("Cara");
  });
});
