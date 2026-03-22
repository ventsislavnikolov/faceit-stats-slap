export type StatsLeaderboardWindowDays = 30 | 90 | 180 | 365 | 730;
export type StatsLeaderboardMatchCount = 20 | 50 | 100;

export function buildStatsLeaderboardSyncKey(params: {
  targetPlayerId: string;
  playerIds: string[];
  n: StatsLeaderboardMatchCount;
  days: StatsLeaderboardWindowDays;
}): string {
  const sortedPlayerIds = [...params.playerIds].sort();
  return `${params.targetPlayerId}|${sortedPlayerIds.join(",")}|${params.n}|${params.days}`;
}

export function shouldAutoSyncStatsLeaderboard(params: {
  targetPlayerId: string;
  playerIds: string[];
  n: StatsLeaderboardMatchCount;
  days: StatsLeaderboardWindowDays;
  isPending: boolean;
  attemptedKeys: Set<string>;
}): boolean {
  if (!params.targetPlayerId) return false;
  if (params.playerIds.length === 0) return false;
  if (params.isPending) return false;

  const key = buildStatsLeaderboardSyncKey(params);
  return !params.attemptedKeys.has(key);
}
