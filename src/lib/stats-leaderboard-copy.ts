export function getStatsLeaderboardSummaryCopy(
  targetNickname: string,
  _sharedFriendCount: number,
  days: 30 | 90 | 180 | 365 | 730,
  n: 20 | 50 | 100,
  queue: "all" | "solo" | "party" = "all"
): string {
  const subject =
    queue === "all"
      ? `Showing friends of ${targetNickname}`
      : `Showing friends of ${targetNickname} from ${queue} matches`;

  return `${subject} in the last ${days} days. Stats are from each player's own last ${n} matches.`;
}

export function getStatsLeaderboardEmptyStateCopy({
  targetNickname,
  targetMatchCount,
  sharedFriendCount,
  days,
  n,
  queue = "all",
}: {
  targetNickname: string;
  targetMatchCount: number;
  sharedFriendCount: number;
  days: 30 | 90 | 180 | 365 | 730;
  n: 20 | 50 | 100;
  queue?: "all" | "solo" | "party";
}): string | null {
  if (sharedFriendCount === 0) {
    return queue === "all"
      ? `No friends of ${targetNickname} played in the last ${days} days.`
      : `No friends of ${targetNickname} played ${queue} matches in the last ${days} days.`;
  }

  return null;
}
