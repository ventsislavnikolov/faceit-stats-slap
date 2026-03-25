import type {
  BetHistorySummary,
  BettingLeaderboardEntry,
  BetWithPool,
} from "~/lib/types";

type BetOutcomeLabel = "Won" | "Lost" | "Refunded" | "Pending";

export function getBetOutcomeLabel(bet: BetWithPool): BetOutcomeLabel {
  if (bet.pool.status === "REFUNDED") {
    return "Refunded";
  }

  if (bet.pool.status !== "RESOLVED") {
    return "Pending";
  }

  if (bet.payout === null) {
    return "Lost";
  }

  return bet.payout > bet.amount ? "Won" : "Lost";
}

export function buildBetHistorySummary(
  bets: BetWithPool[],
  coins: number
): BetHistorySummary {
  let betsWon = 0;
  let resolvedBets = 0;
  let refundedBets = 0;
  let pendingBets = 0;
  let totalWagered = 0;
  let totalReturned = 0;

  for (const bet of bets) {
    totalWagered += bet.amount;

    if (bet.pool.status === "REFUNDED") {
      refundedBets += 1;
      totalReturned += bet.payout ?? bet.amount;
      continue;
    }

    if (bet.pool.status !== "RESOLVED") {
      pendingBets += 1;
      continue;
    }

    resolvedBets += 1;
    totalReturned += bet.payout ?? 0;

    if ((bet.payout ?? 0) > bet.amount) {
      betsWon += 1;
    }
  }

  return {
    coins,
    betsPlaced: bets.length,
    betsWon,
    resolvedBets,
    refundedBets,
    pendingBets,
    totalWagered,
    totalReturned,
    netProfit: totalReturned - totalWagered,
    winRate: resolvedBets > 0 ? Math.round((betsWon / resolvedBets) * 100) : 0,
  };
}

export function sortBettingLeaderboardEntries(
  entries: BettingLeaderboardEntry[]
): BettingLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.netProfit !== a.netProfit) {
      return b.netProfit - a.netProfit;
    }

    return b.coins - a.coins;
  });
}
