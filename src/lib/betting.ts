import type { BettingPoolStatus } from "~/lib/types";

/**
 * Calculates pari-mutuel payout for a winning bet.
 * Uses Math.floor — small remainders (<1 coin per winner) stay in the pool.
 * Acceptable for a small friend-group app.
 */
export function calculatePayout(
  betAmount: number,
  winningSideTotal: number,
  losingSideTotal: number
): number {
  if (losingSideTotal === 0 || winningSideTotal === 0) {
    return betAmount;
  }
  return (
    Math.floor((betAmount / winningSideTotal) * losingSideTotal) + betAmount
  );
}

export function calculateReturnPct(
  betAmount: number,
  winningSideTotal: number,
  losingSideTotal: number
): number {
  const payout = calculatePayout(betAmount, winningSideTotal, losingSideTotal);
  if (payout === betAmount) {
    return 0;
  }
  return Math.floor(((payout - betAmount) / betAmount) * 100);
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
