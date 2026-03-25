import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BetHistoryTab } from "~/components/BetHistoryTab";

vi.mock("~/hooks/useUserBets", () => ({
  useUserBets: vi.fn(),
}));

vi.mock("~/hooks/useCoinBalance", () => ({
  useCoinBalance: vi.fn(),
}));

import { useUserBets } from "~/hooks/useUserBets";
import { useCoinBalance } from "~/hooks/useCoinBalance";

function makeBet(overrides: Record<string, unknown> = {}) {
  return {
    id: "bet-1",
    poolId: "pool-1",
    userId: "user-1",
    side: "team1",
    amount: 100,
    payout: 180,
    createdAt: "2026-03-24T12:01:00.000Z",
    pool: {
      id: "pool-1",
      faceitMatchId: "match-1",
      status: "RESOLVED",
      team1Name: "Flawlesss",
      team2Name: "Opponents",
      team1Pool: 100,
      team2Pool: 100,
      winningTeam: "team1",
      opensAt: "2026-03-24T12:00:00.000Z",
      closesAt: "2026-03-24T12:05:00.000Z",
      resolvedAt: "2026-03-24T13:00:00.000Z",
    },
    audit: {
      id: "audit-1",
      betId: "bet-1",
      poolId: "pool-1",
      faceitMatchId: "match-1",
      userId: "user-1",
      side: "team1",
      amount: 100,
      betCreatedAt: "2026-03-24T12:01:00.000Z",
      matchStartedAt: "2026-03-24T12:00:00.000Z",
      secondsSinceMatchStart: 60,
      capturedPoolStatus: "OPEN",
      createdAt: "2026-03-24T12:01:00.000Z",
    },
    ...overrides,
  };
}

describe("BetHistoryTab", () => {
  it("renders summary cards before the ledger", () => {
    vi.mocked(useCoinBalance).mockReturnValue({ data: 1240 } as any);
    vi.mocked(useUserBets).mockReturnValue({
      data: [makeBet()],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetHistoryTab userId="user-1" />);

    expect(html).toContain("Net P/L");
    expect(html).toContain("Latest Bets");
    expect(html.indexOf("Net P/L")).toBeLessThan(html.indexOf("Latest Bets"));
  });

  it("shows a clear empty state when there are no bets", () => {
    vi.mocked(useCoinBalance).mockReturnValue({ data: 1000 } as any);
    vi.mocked(useUserBets).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetHistoryTab userId="user-1" />);

    expect(html).toContain("No bets placed yet");
  });

  it("renders distinct status labels for won, lost, refunded, and pending bets", () => {
    vi.mocked(useCoinBalance).mockReturnValue({ data: 1240 } as any);
    vi.mocked(useUserBets).mockReturnValue({
      data: [
        makeBet(),
        makeBet({
          id: "bet-2",
          payout: 50,
          amount: 50,
          pool: {
            ...makeBet().pool,
            id: "pool-2",
            status: "REFUNDED",
          },
        }),
        makeBet({
          id: "bet-3",
          amount: 90,
          payout: null,
          pool: {
            ...makeBet().pool,
            id: "pool-3",
            status: "RESOLVED",
            winningTeam: "team2",
            resolvedAt: "2026-03-24T13:00:00.000Z",
          },
        }),
        makeBet({
          id: "bet-4",
          payout: null,
          pool: {
            ...makeBet().pool,
            id: "pool-4",
            status: "OPEN",
            resolvedAt: null,
          },
        }),
      ],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetHistoryTab userId="user-1" />);

    expect(html).toContain("Won");
    expect(html).toContain("Lost");
    expect(html).toContain("Refunded");
    expect(html).toContain("Pending");
    expect(html).toContain("-90");
    expect(html).toContain(">0<");
  });

  it("renders match-relative timing when audit metadata is available", () => {
    vi.mocked(useCoinBalance).mockReturnValue({ data: 1240 } as any);
    vi.mocked(useUserBets).mockReturnValue({
      data: [makeBet()],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetHistoryTab userId="user-1" />);

    expect(html).toContain("Placed 1m 00s after match start");
  });

  it("shows sign-in and error states clearly", () => {
    vi.mocked(useCoinBalance).mockReturnValue({ data: 0 } as any);
    vi.mocked(useUserBets).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    expect(renderToStaticMarkup(<BetHistoryTab userId={null} />)).toContain(
      "Sign in to see your bets",
    );

    vi.mocked(useUserBets).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
    } as any);

    expect(renderToStaticMarkup(<BetHistoryTab userId="user-1" />)).toContain(
      "Failed to load betting history",
    );
  });
});
