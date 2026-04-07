import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SeasonMyBetsTab } from "~/components/SeasonMyBetsTab";

vi.mock("~/hooks/useUserBets", () => ({
  useUserBets: vi.fn(),
}));

import { useUserBets } from "~/hooks/useUserBets";

describe("SeasonMyBetsTab", () => {
  it("renders both match bets and prop bets", () => {
    vi.mocked(useUserBets).mockReturnValue({
      data: [
        {
          kind: "match",
          id: "bet-1",
          poolId: "pool-1",
          propPoolId: null,
          userId: "user-1",
          side: "team1",
          amount: 50,
          payout: 100,
          createdAt: "2026-04-07T10:00:00.000Z",
          pool: {
            id: "pool-1",
            faceitMatchId: "match-1",
            status: "RESOLVED",
            team1Name: "Alpha",
            team2Name: "Bravo",
            team1Pool: 100,
            team2Pool: 100,
            winningTeam: "team1",
            opensAt: "2026-04-07T10:00:00.000Z",
            closesAt: "2026-04-07T10:05:00.000Z",
            resolvedAt: "2026-04-07T11:00:00.000Z",
          },
        },
        {
          kind: "prop",
          id: "bet-2",
          poolId: null,
          propPoolId: "prop-1",
          userId: "user-1",
          side: "yes",
          amount: 25,
          payout: 60,
          createdAt: "2026-04-07T10:01:00.000Z",
          prop: {
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
            outcome: true,
            status: "resolved",
            opensAt: "2026-04-07T10:00:00.000Z",
            closesAt: "2026-04-07T10:05:00.000Z",
            resolvedAt: "2026-04-07T11:00:00.000Z",
            createdAt: "2026-04-07T10:00:00.000Z",
          },
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(
      <SeasonMyBetsTab seasonId="season-1" userId="user-1" />
    );

    expect(html).toContain("Alpha vs Bravo");
    expect(html).toContain("boR0 16+ kills");
    expect(html).toContain("Won");
  });
});
