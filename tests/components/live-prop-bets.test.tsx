import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchCard } from "~/components/LiveMatchCard";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("~/hooks/useBettingPool", () => ({
  useBettingPool: vi.fn(),
}));

vi.mock("~/hooks/useMatchStats", () => ({
  useMatchStats: vi.fn(),
}));

vi.mock("~/hooks/usePropPools", () => ({
  usePropPools: vi.fn(),
}));

vi.mock("~/hooks/useUserPropBetsForMatch", () => ({
  useUserPropBetsForMatch: vi.fn(),
}));

vi.mock("~/components/BettingPanel", () => ({
  BettingPanel: () => <div>BETTING_PANEL</div>,
}));

import { useBettingPool } from "~/hooks/useBettingPool";
import { useMatchStats } from "~/hooks/useMatchStats";
import { usePropPools } from "~/hooks/usePropPools";
import { useUserPropBetsForMatch } from "~/hooks/useUserPropBetsForMatch";

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

const openProp = {
  id: "prop-1",
  seasonId: "season-1",
  faceitMatchId: "match-1",
  playerId: "player-1",
  playerNickname: "boR0",
  statKey: "kills",
  threshold: 16,
  description: "boR0 16+ kills",
  yesPool: 10,
  noPool: 15,
  outcome: null,
  status: "open",
  opensAt: "2026-04-07T10:00:00.000Z",
  closesAt: new Date(Date.now() + 60_000).toISOString(),
  resolvedAt: null,
  createdAt: "2026-04-07T10:00:00.000Z",
} as const;

describe("live prop bets", () => {
  it("renders open prop bets on the live match card", () => {
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
    vi.mocked(usePropPools).mockReturnValue({
      data: [openProp],
    } as any);
    vi.mocked(useUserPropBetsForMatch).mockReturnValue({
      data: [],
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard
        authResolved={true}
        bettingContextReady={true}
        match={match}
        seasonId="season-1"
        userCoins={123}
        userId="user-1"
      />
    );

    expect(html).toContain("boR0 16+ kills");
    expect(html).toContain("Yes");
    expect(html).toContain("No");
  });

  it("hides closed prop bets when the user never placed one", () => {
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
    vi.mocked(usePropPools).mockReturnValue({
      data: [{ ...openProp, status: "closed", closesAt: new Date(Date.now() - 60_000).toISOString() }],
    } as any);
    vi.mocked(useUserPropBetsForMatch).mockReturnValue({
      data: [],
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard
        authResolved={true}
        bettingContextReady={true}
        match={match}
        seasonId="season-1"
        userCoins={123}
        userId="user-1"
      />
    );

    expect(html).not.toContain("boR0 16+ kills");
  });

  it("keeps a closed prop visible when the user already placed a bet", () => {
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
    vi.mocked(usePropPools).mockReturnValue({
      data: [{ ...openProp, status: "closed", closesAt: new Date(Date.now() - 60_000).toISOString() }],
    } as any);
    vi.mocked(useUserPropBetsForMatch).mockReturnValue({
      data: [
        {
          id: "bet-1",
          propPoolId: "prop-1",
          poolId: null,
          userId: "user-1",
          side: "yes",
          amount: 25,
          payout: null,
          createdAt: "2026-04-07T10:01:00.000Z",
        },
      ],
    } as any);

    const html = renderToStaticMarkup(
      <LiveMatchCard
        authResolved={true}
        bettingContextReady={true}
        match={match}
        seasonId="season-1"
        userCoins={123}
        userId="user-1"
      />
    );

    expect(html).toContain("boR0 16+ kills");
    expect(html).toContain("Your bet");
    expect(html).not.toContain(">Closed<");
  });
});
