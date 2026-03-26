import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/live-match", () => ({
  getFriendScoreboardPlayers: vi.fn(),
}));

import { LiveScoreboard } from "~/components/LiveScoreboard";
import { getFriendScoreboardPlayers } from "~/lib/live-match";

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

describe("LiveScoreboard", () => {
  it("returns null when no friend stats", () => {
    vi.mocked(getFriendScoreboardPlayers).mockReturnValue([]);

    const html = renderToStaticMarkup(
      <LiveScoreboard friendIds={["p1"]} players={[makePlayer()]} />
    );

    expect(html).toBe("");
  });

  it("renders player stats when friends found", () => {
    const player = makePlayer({
      playerId: "p1",
      nickname: "Alice",
      kills: 20,
      deaths: 10,
      assists: 5,
      kdRatio: 2.0,
      adr: 95.4,
    });

    vi.mocked(getFriendScoreboardPlayers).mockReturnValue([player]);

    const html = renderToStaticMarkup(
      <LiveScoreboard friendIds={["p1"]} players={[player]} />
    );

    expect(html).toContain("Live Squad Stats");
    expect(html).toContain("Alice");
    expect(html).toContain("20");
    expect(html).toContain("10");
    expect(html).toContain("5");
    expect(html).toContain("2.00");
    expect(html).toContain("95");
  });

  it("highlights first player with accent color", () => {
    const players = [
      makePlayer({ playerId: "p1", nickname: "Alice", kills: 20 }),
      makePlayer({ playerId: "p2", nickname: "Bob", kills: 15 }),
    ];

    vi.mocked(getFriendScoreboardPlayers).mockReturnValue(players);

    const html = renderToStaticMarkup(
      <LiveScoreboard friendIds={["p1", "p2"]} players={players} />
    );

    expect(html).toContain("bg-accent/8");
    expect(html).toContain("text-accent");

    const aliceIdx = html.indexOf("Alice");
    const accentIdx = html.indexOf("text-accent");
    expect(accentIdx).toBeLessThan(aliceIdx);
  });

  it("shows K/D ratio in green for >= 1", () => {
    const player = makePlayer({ kdRatio: 1.5 });
    vi.mocked(getFriendScoreboardPlayers).mockReturnValue([player]);

    const html = renderToStaticMarkup(
      <LiveScoreboard friendIds={["p1"]} players={[player]} />
    );

    expect(html).toContain("text-accent");
    expect(html).toContain("1.50");
  });

  it("shows K/D ratio in red for < 1", () => {
    const player = makePlayer({ kdRatio: 0.75 });
    vi.mocked(getFriendScoreboardPlayers).mockReturnValue([player]);

    const html = renderToStaticMarkup(
      <LiveScoreboard friendIds={["p1"]} players={[player]} />
    );

    expect(html).toContain("text-error/70");
    expect(html).toContain("0.75");
  });
});
