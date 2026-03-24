import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchCard } from "~/components/LiveMatchCard";

vi.mock("~/hooks/useBettingPool", () => ({
  useBettingPool: vi.fn(),
}));

vi.mock("~/hooks/useMatchStats", () => ({
  useMatchStats: vi.fn(),
}));

vi.mock("~/components/BettingPanel", () => ({
  BettingPanel: () => <div>BETTING_PANEL</div>,
}));

import { useBettingPool } from "~/hooks/useBettingPool";
import { useMatchStats } from "~/hooks/useMatchStats";

const match = {
  matchId: "match-1",
  status: "ONGOING",
  map: "de_inferno",
  score: { faction1: 0, faction2: 0 },
  startedAt: 123,
  teams: {
    faction1: { teamId: "t1", name: "Team One", roster: [] },
    faction2: { teamId: "t2", name: "Team Two", roster: [] },
  },
  friendFaction: "faction1",
  friendIds: ["friend-1"],
} as any;

describe("LiveMatchCard", () => {
  it("renders the public match card before auth resolves without betting ui", () => {
    vi.mocked(useBettingPool).mockReturnValue({
      data: {
        pool: {
          id: "pool-1",
          status: "OPEN",
          closesAt: new Date(Date.now() + 60_000).toISOString(),
          team1Name: "Team One",
          team2Name: "Team Two",
          team1Pool: 100,
          team2Pool: 100,
        },
        userBet: null,
      },
    } as any);
    vi.mocked(useMatchStats).mockReturnValue({
      data: {
        teams: {
          faction1: { score: 0 },
          faction2: { score: 0 },
        },
        players: [],
      },
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard match={match} authResolved={false} />,
    );

    expect(html).toContain("LIVE");
    expect(html).toContain("inferno");
    expect(html).not.toContain("BETTING_PANEL");
  });

  it("keeps betting ui hidden while signed-in balance is still loading", () => {
    vi.mocked(useBettingPool).mockReturnValue({
      data: {
        pool: {
          id: "pool-1",
          status: "OPEN",
          closesAt: new Date(Date.now() + 60_000).toISOString(),
          team1Name: "Team One",
          team2Name: "Team Two",
          team1Pool: 100,
          team2Pool: 100,
        },
        userBet: null,
      },
    } as any);
    vi.mocked(useMatchStats).mockReturnValue({
      data: {
        teams: {
          faction1: { score: 0 },
          faction2: { score: 0 },
        },
        players: [],
      },
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard
        match={match}
        authResolved={true}
        bettingContextReady={false}
        userId="user-1"
        userCoins={0}
      />,
    );

    expect(html).toContain("LIVE");
    expect(html).not.toContain("BETTING_PANEL");
  });

  it("renders the betting panel after auth resolves", () => {
    vi.mocked(useBettingPool).mockReturnValue({
      data: {
        pool: {
          id: "pool-1",
          status: "OPEN",
          closesAt: new Date(Date.now() + 60_000).toISOString(),
          team1Name: "Team One",
          team2Name: "Team Two",
          team1Pool: 100,
          team2Pool: 100,
        },
        userBet: null,
      },
    } as any);
    vi.mocked(useMatchStats).mockReturnValue({
      data: {
        teams: {
          faction1: { score: 0 },
          faction2: { score: 0 },
        },
        players: [],
      },
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard
        match={match}
        authResolved={true}
        bettingContextReady={true}
        userId="user-1"
        userCoins={1234}
      />,
    );

    expect(html).toContain("LIVE");
    expect(html).toContain("BETTING_PANEL");
  });
});
