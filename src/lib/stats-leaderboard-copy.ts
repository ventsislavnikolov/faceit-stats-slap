export function getStatsLeaderboardSummaryCopy(
  targetNickname: string,
  _sharedFriendCount: number,
  days: 30 | 90 | 180 | 365 | 730,
  n: "yesterday" | 20 | 50 | 100,
  queue: "all" | "solo" | "party" = "all"
): string {
  const subject =
    queue === "all"
      ? `Showing friends of ${targetNickname}`
      : `Showing friends of ${targetNickname} from ${queue} matches`;

  if (n === "yesterday") {
    return queue === "all"
      ? `${subject} who played yesterday. Stats are from yesterday's matches only.`
      : `${subject} yesterday. Stats are from yesterday's matches only.`;
  }

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
  n: "yesterday" | 20 | 50 | 100;
  queue?: "all" | "solo" | "party";
}): string | null {
  if (n === "yesterday") {
    if (sharedFriendCount === 0) {
      return queue === "all"
        ? `No friends of ${targetNickname} played yesterday.`
        : `No friends of ${targetNickname} played ${queue} matches yesterday.`;
    }

    return null;
  }

  if (sharedFriendCount === 0) {
    return queue === "all"
      ? `No friends of ${targetNickname} played in the last ${days} days.`
      : `No friends of ${targetNickname} played ${queue} matches in the last ${days} days.`;
  }

  return null;
}
