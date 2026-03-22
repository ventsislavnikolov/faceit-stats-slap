export function getStatsLeaderboardSummaryCopy(
  _targetNickname: string,
  _sharedFriendCount: number,
  days: 30 | 90 | 180 | 365,
  n: 20 | 50 | 100
): string {
  return `Showing players you queued with in the last ${days} days. Stats are from each player's own last ${n} matches.`;
}

export function getStatsLeaderboardEmptyStateCopy({
  targetNickname,
  targetMatchCount,
  sharedFriendCount,
  days,
}: {
  targetNickname: string;
  targetMatchCount: number;
  sharedFriendCount: number;
  days: 30 | 90 | 180 | 365;
}): string | null {
  if (targetMatchCount === 0) {
    return `No recent matches for ${targetNickname} in the last ${days} days.`;
  }

  if (sharedFriendCount === 0) {
    return `No recently queued friends for ${targetNickname} in the last ${days} days.`;
  }

  return null;
}
