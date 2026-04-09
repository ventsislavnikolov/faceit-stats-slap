import type { BettingPoolStatus } from "~/lib/types";

/**
 * Fixed 2x payout for winning bets.
 * Win = double your bet. Lose = lose your bet.
 */
export function calculatePayout(betAmount: number): number {
  return betAmount * 2;
}

export function calculateReturnPct(): number {
  return 100;
}

export function isBettingOpen(
  status: BettingPoolStatus,
  closesAt: string
): boolean {
  return status === "OPEN" && new Date(closesAt) > new Date();
}

export function formatBetTiming(
  secondsSinceMatchStart: number | null | undefined
): string | null {
  if (secondsSinceMatchStart == null || secondsSinceMatchStart < 0) {
    return null;
  }

  if (secondsSinceMatchStart < 60) {
    return `Placed ${secondsSinceMatchStart}s after match start`;
  }

  const minutes = Math.floor(secondsSinceMatchStart / 60);
  const seconds = secondsSinceMatchStart % 60;
  return `Placed ${minutes}m ${seconds.toString().padStart(2, "0")}s after match start`;
}
