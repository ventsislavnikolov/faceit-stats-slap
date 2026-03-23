export function getStatsLeaderboardSummaryCopy(
  _targetNickname: string,
  _sharedFriendCount: number,
  days: 30 | 90 | 180 | 365 | 730,
  n: 20 | 50 | 100,
  queue: "all" | "solo" | "party" = "all"
): string {
  const subject =
    queue === "all"
      ? "Showing players you queued with"
      : `Showing players from ${queue} matches`;

  return `${subject} in the last ${days} days. Stats are from each player's own last ${n} matches.`;
}

export function getStatsLeaderboardEmptyStateCopy({
  targetNickname,
  targetMatchCount,
  sharedFriendCount,
  days,
  queue = "all",
}: {
  targetNickname: string;
  targetMatchCount: number;
  sharedFriendCount: number;
  days: 30 | 90 | 180 | 365 | 730;
  queue?: "all" | "solo" | "party";
}): string | null {
  if (targetMatchCount === 0) {
    return queue === "all"
      ? `No recent matches for ${targetNickname} in the last ${days} days.`
      : `No recent ${queue} matches for ${targetNickname} in the last ${days} days.`;
  }

  if (sharedFriendCount === 0) {
    return queue === "all"
      ? `No recently queued friends for ${targetNickname} in the last ${days} days.`
      : `No recently queued friends for ${targetNickname} in ${queue} matches in the last ${days} days.`;
  }

  return null;
}
