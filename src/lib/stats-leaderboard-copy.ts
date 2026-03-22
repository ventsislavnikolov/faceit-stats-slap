export function getStatsLeaderboardSummaryCopy(
  targetNickname: string,
  sharedFriendCount: number,
  days: 7 | 30 | 90
): string {
  const label = sharedFriendCount === 1 ? "shared friend" : "shared friends";
  return `Recent squad leaderboard for ${targetNickname} · ${sharedFriendCount} ${label} in the last ${days} days`;
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
  days: 7 | 30 | 90;
}): string | null {
  if (targetMatchCount === 0) {
    return `No recent matches for ${targetNickname} in the last ${days} days.`;
  }

  if (sharedFriendCount === 0) {
    return `No friends played with ${targetNickname} in the last ${days} days.`;
  }

  return null;
}
