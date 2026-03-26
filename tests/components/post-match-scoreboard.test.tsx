import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/banter", () => ({
  getBanterLine: vi.fn(() => "mock banter"),
}));

import { PostMatchScoreboard } from "~/components/PostMatchScoreboard";

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
    ...overrides,
  } as any;
}

describe("PostMatchScoreboard", () => {
  it("returns null when no friends in players", () => {
    const player = makePlayer({ playerId: "p1" });

    const html = renderToStaticMarkup(
      <PostMatchScoreboard
        friendIds={["not-in-match"]}
        matchId="m1"
        players={[player]}
      />
    );

    expect(html).toBe("");
  });

  it("renders squad table with player stats and crown/skull emojis", () => {
    const players = [
      makePlayer({ playerId: "p1", nickname: "Alice", kills: 25, deaths: 10 }),
      makePlayer({ playerId: "p2", nickname: "Bob", kills: 15, deaths: 18 }),
    ];

    const html = renderToStaticMarkup(
      <PostMatchScoreboard
        friendIds={["p1", "p2"]}
        matchId="m1"
        players={players}
      />
    );

    expect(html).toContain("Your Squad");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    // Crown for top fragger
    expect(html).toContain("\u{1F451}");
    // Skull for bottom fragger
    expect(html).toContain("\u{1F480}");
    // Top fragger highlighted
    expect(html).toContain("bg-accent/8");
    // Bottom fragger dimmed
    expect(html).toContain("bg-error/5");
  });

  it("shows multi-kill badges", () => {
    const players = [
      makePlayer({
        playerId: "p1",
        nickname: "Alice",
        kills: 25,
        tripleKills: 2,
        quadroKills: 1,
        pentaKills: 0,
      }),
      makePlayer({
        playerId: "p2",
        nickname: "Bob",
        kills: 15,
        tripleKills: 0,
        quadroKills: 0,
        pentaKills: 1,
      }),
    ];

    const html = renderToStaticMarkup(
      <PostMatchScoreboard
        friendIds={["p1", "p2"]}
        matchId="m1"
        players={players}
      />
    );

    expect(html).toContain("2x Triple");
    expect(html).toContain("1x Quadro");
    expect(html).toContain("1x Penta");
  });

  it("shows banter when 2+ friends present", () => {
    const players = [
      makePlayer({ playerId: "p1", nickname: "Alice", kills: 25 }),
      makePlayer({ playerId: "p2", nickname: "Bob", kills: 15 }),
    ];

    const html = renderToStaticMarkup(
      <PostMatchScoreboard
        friendIds={["p1", "p2"]}
        matchId="m1"
        players={players}
      />
    );

    expect(html).toContain("mock banter");
  });

  it("shows no banter with only 1 friend", () => {
    const players = [
      makePlayer({ playerId: "p1", nickname: "Alice", kills: 25 }),
      makePlayer({ playerId: "p2", nickname: "Bob", kills: 15 }),
    ];

    const html = renderToStaticMarkup(
      <PostMatchScoreboard friendIds={["p1"]} matchId="m1" players={players} />
    );

    expect(html).not.toContain("mock banter");
  });

  it("does not show multi-kill section when no multi-kills", () => {
    const players = [
      makePlayer({ playerId: "p1", nickname: "Alice", kills: 25 }),
      makePlayer({ playerId: "p2", nickname: "Bob", kills: 15 }),
    ];

    const html = renderToStaticMarkup(
      <PostMatchScoreboard
        friendIds={["p1", "p2"]}
        matchId="m1"
        players={players}
      />
    );

    expect(html).not.toContain("Triple");
    expect(html).not.toContain("Quadro");
    expect(html).not.toContain("Penta");
  });
});
