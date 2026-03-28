import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BetsLeaderboardTab } from "~/components/BetsLeaderboardTab";

vi.mock("~/hooks/useLeaderboard", () => ({
  useLeaderboard: vi.fn(),
}));

import { useLeaderboard } from "~/hooks/useLeaderboard";

describe("BetsLeaderboardTab", () => {
  it("renders profit ahead of the supporting betting columns", () => {
    vi.mocked(useLeaderboard).mockReturnValue({
      data: [
        {
          userId: "user-1",
          nickname: "alpha",
          coins: 900,
          betsPlaced: 4,
          betsWon: 2,
          resolvedBets: 3,
          totalWagered: 300,
          totalReturned: 360,
          netProfit: 60,
          winRate: 67,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetsLeaderboardTab userId="user-2" />);

    expect(html).toContain(">P/L<");
    expect(html).toContain(">Coins<");
    expect(html.indexOf(">P/L<")).toBeLessThan(html.indexOf(">Coins<"));
  });

  it("highlights the current user row when present", () => {
    vi.mocked(useLeaderboard).mockReturnValue({
      data: [
        {
          userId: "user-1",
          nickname: "alpha",
          coins: 900,
          betsPlaced: 4,
          betsWon: 2,
          resolvedBets: 3,
          totalWagered: 300,
          totalReturned: 360,
          netProfit: 60,
          winRate: 67,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(<BetsLeaderboardTab userId="user-1" />);

    expect(html).toContain("border-accent");
    expect(html).toContain("border-l-2");
    expect(html).toContain(">You<");
  });

  it("shows clear loading, error, and empty states", () => {
    vi.mocked(useLeaderboard).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    } as any);

    expect(
      renderToStaticMarkup(<BetsLeaderboardTab userId={null} />)
    ).toContain("Loading...");

    vi.mocked(useLeaderboard).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
    } as any);

    expect(
      renderToStaticMarkup(<BetsLeaderboardTab userId={null} />)
    ).toContain("Failed to load betting leaderboard");

    vi.mocked(useLeaderboard).mockReturnValue({
      data: [
        {
          userId: "user-1",
          nickname: "alpha",
          coins: 1000,
          betsPlaced: 0,
          betsWon: 0,
          resolvedBets: 0,
          totalWagered: 0,
          totalReturned: 0,
          netProfit: 0,
          winRate: 0,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    expect(
      renderToStaticMarkup(<BetsLeaderboardTab userId={null} />)
    ).toContain("No resolved bets yet");
  });
});
