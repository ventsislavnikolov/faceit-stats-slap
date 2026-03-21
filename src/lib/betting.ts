import { BettingPoolStatus } from "~/lib/types";

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
  if (losingSideTotal === 0 || winningSideTotal === 0) return betAmount;
  return Math.floor((betAmount / winningSideTotal) * losingSideTotal) + betAmount;
}

export function calculateReturnPct(
  betAmount: number,
  winningSideTotal: number,
  losingSideTotal: number
): number {
  const payout = calculatePayout(betAmount, winningSideTotal, losingSideTotal);
  if (payout === betAmount) return 0;
  return Math.floor(((payout - betAmount) / betAmount) * 100);
}

export function isBettingOpen(status: BettingPoolStatus, closesAt: string): boolean {
  return status === "OPEN" && new Date(closesAt) > new Date();
}
