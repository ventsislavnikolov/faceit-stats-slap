export type LeaderboardTab = "stats" | "bets";

const LEADERBOARD_TABS: LeaderboardTab[] = ["stats", "bets"];

export function getLeaderboardTabs(isSignedIn: boolean): LeaderboardTab[] {
  return isSignedIn ? LEADERBOARD_TABS : ["stats"];
}

export function normalizeLeaderboardTab(
  tab: unknown,
  isSignedIn: boolean,
): LeaderboardTab {
  const normalized = tab === "bets" ? "bets" : "stats";

  if (!isSignedIn && normalized === "bets") {
    return "stats";
  }

  return normalized;
}

export function shouldEnableLeaderboardFriendLookup(
  tab: LeaderboardTab,
  authResolved: boolean,
): boolean {
  return authResolved && tab === "stats";
}
