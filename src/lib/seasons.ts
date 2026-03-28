import type { SeasonStatus } from "~/lib/types";

export function getSeasonStatus(
  startsAt: string,
  endsAt: string
): SeasonStatus {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) {
    return "upcoming";
  }
  if (now > new Date(endsAt).getTime()) {
    return "completed";
  }
  return "active";
}

export function isSeasonActive(status: SeasonStatus): boolean {
  return status === "active";
}

export function formatSeasonDateRange(
  startsAt: string,
  endsAt: string
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function calculateMultiplier(
  betAmount: number,
  sideTotal: number,
  otherSideTotal: number
): string {
  if (sideTotal === 0 || otherSideTotal === 0) {
    return "—";
  }
  const payout =
    Math.floor((betAmount / (sideTotal + betAmount)) * otherSideTotal) +
    betAmount;
  return `${(payout / betAmount).toFixed(1)}x`;
}
