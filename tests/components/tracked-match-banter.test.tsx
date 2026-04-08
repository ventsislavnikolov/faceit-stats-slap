import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/banter", () => ({
  getBanterLine: vi.fn(
    (type: string, name: string, matchId: string) =>
      `${type}:${name}:${matchId}`
  ),
}));

import { TrackedMatchBanter } from "~/components/TrackedMatchBanter";

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    playerId: "p1",
    nickname: "Alice",
    kills: 20,
    deaths: 10,
    assists: 5,
    kdRatio: 2.0,
    adr: 95,
    hsPercent: 50,
    mvps: 3,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    headshots: 10,
    krRatio: 0.8,
    result: true,
    damage: 1800,
    firstKills: 1,
    entryCount: 2,
    entryWins: 1,
    clutchKills: 0,
    oneV1Count: 0,
    oneV1Wins: 0,
    oneV2Count: 0,
    oneV2Wins: 0,
    doubleKills: 0,
    utilityDamage: 0,
    enemiesFlashed: 0,
    flashCount: 0,
    sniperKills: 0,
    pistolKills: 0,
    ...overrides,
  } as any;
}

describe("TrackedMatchBanter", () => {
  it("renders banter for tracked players only", () => {
    const html = renderToStaticMarkup(
      <TrackedMatchBanter
        friendIds={["p2", "p3"]}
        matchId="match-1"
        players={[
          makePlayer({ playerId: "p1", nickname: "Alice", kills: 30 }),
          makePlayer({ playerId: "p2", nickname: "Bob", kills: 9 }),
          makePlayer({ playerId: "p3", nickname: "Charlie", kills: 22 }),
        ]}
      />
    );

    expect(html).toContain("carry:Charlie:match-1");
    expect(html).toContain("roast:Bob:match-1");
    expect(html).not.toContain("Alice");
  });

  it("renders nothing when fewer than two tracked players are in the match", () => {
    const html = renderToStaticMarkup(
      <TrackedMatchBanter
        friendIds={["p2"]}
        matchId="match-1"
        players={[
          makePlayer({ playerId: "p1", nickname: "Alice", kills: 30 }),
          makePlayer({ playerId: "p2", nickname: "Bob", kills: 9 }),
        ]}
      />
    );

    expect(html).toBe("");
  });
});
