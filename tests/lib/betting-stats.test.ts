import { describe, expect, it } from "vitest";
import type { BetWithPool, BettingPool, BettingLeaderboardEntry } from "~/lib/types";
import {
  buildBetHistorySummary,
  getBetOutcomeLabel,
  sortBettingLeaderboardEntries,
} from "~/lib/betting-stats";

function makePool(overrides: Partial<BettingPool> = {}): BettingPool {
  return {
    id: "pool-1",
    faceitMatchId: "match-1",
    status: "OPEN",
    team1Name: "Team 1",
    team2Name: "Team 2",
    team1Pool: 100,
    team2Pool: 100,
    winningTeam: null,
    opensAt: "2026-03-24T12:00:00.000Z",
    closesAt: "2026-03-24T12:05:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function makeBet(overrides: Partial<BetWithPool> = {}): BetWithPool {
  return {
    id: "bet-1",
    poolId: "pool-1",
    userId: "user-1",
    side: "team1",
    amount: 100,
    payout: null,
    createdAt: "2026-03-24T12:01:00.000Z",
    pool: makePool(),
    ...overrides,
  };
}

describe("getBetOutcomeLabel", () => {
  it("labels resolved payouts greater than stake as wins", () => {
    expect(
      getBetOutcomeLabel(
        makeBet({
          amount: 100,
          payout: 180,
          pool: makePool({ status: "RESOLVED", winningTeam: "team1" }),
        }),
      ),
    ).toBe("Won");
  });

  it("labels refunds explicitly", () => {
    expect(
      getBetOutcomeLabel(
        makeBet({
          amount: 100,
          payout: 100,
          pool: makePool({ status: "REFUNDED" }),
        }),
      ),
    ).toBe("Refunded");
  });

  it("labels unresolved bets as pending", () => {
    expect(getBetOutcomeLabel(makeBet())).toBe("Pending");
  });
});

describe("buildBetHistorySummary", () => {
  it("derives resolved, refunded, pending, and net profit totals", () => {
    const summary = buildBetHistorySummary(
      [
        makeBet({
          amount: 100,
          payout: 180,
          pool: makePool({ status: "RESOLVED", winningTeam: "team1" }),
        }),
        makeBet({
          id: "bet-2",
          amount: 75,
          payout: 0,
          pool: makePool({ id: "pool-2", status: "RESOLVED", winningTeam: "team2" }),
        }),
        makeBet({
          id: "bet-3",
          amount: 50,
          payout: 50,
          pool: makePool({ id: "pool-3", status: "REFUNDED" }),
        }),
        makeBet({
          id: "bet-4",
          amount: 25,
          payout: null,
          pool: makePool({ id: "pool-4", status: "OPEN" }),
        }),
      ],
      1240,
    );

    expect(summary).toMatchObject({
      coins: 1240,
      betsPlaced: 4,
      betsWon: 1,
      resolvedBets: 2,
      refundedBets: 1,
      pendingBets: 1,
      totalWagered: 250,
      totalReturned: 230,
      netProfit: -20,
      winRate: 50,
    });
  });
});

describe("sortBettingLeaderboardEntries", () => {
  it("sorts by net profit and then coins", () => {
    const entries: BettingLeaderboardEntry[] = [
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
      {
        userId: "user-2",
        nickname: "bravo",
        coins: 1100,
        betsPlaced: 5,
        betsWon: 2,
        resolvedBets: 4,
        totalWagered: 400,
        totalReturned: 460,
        netProfit: 60,
        winRate: 50,
      },
      {
        userId: "user-3",
        nickname: "charlie",
        coins: 1500,
        betsPlaced: 2,
        betsWon: 1,
        resolvedBets: 1,
        totalWagered: 150,
        totalReturned: 120,
        netProfit: -30,
        winRate: 100,
      },
    ];

    expect(sortBettingLeaderboardEntries(entries).map((entry) => entry.userId)).toEqual([
      "user-2",
      "user-1",
      "user-3",
    ]);
  });
});
