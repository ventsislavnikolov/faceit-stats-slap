import { useQuery } from "@tanstack/react-query";
import { getStatsLeaderboard } from "~/server/matches";
import type { StatsLeaderboardResult } from "~/lib/types";

export function useStatsLeaderboard(params: {
  targetPlayerId: string;
  playerIds: string[];
  n: 20 | 50 | 100;
  days: 30 | 90 | 180 | 365 | 730;
}) {
  const { targetPlayerId, playerIds, n, days } = params;

  return useQuery<StatsLeaderboardResult>({
    queryKey: ["stats-leaderboard", targetPlayerId, playerIds, n, days],
    queryFn: () =>
      getStatsLeaderboard({
        data: { targetPlayerId, playerIds, n, days },
      }),
    enabled: !!targetPlayerId,
    staleTime: 5 * 60 * 1000,
  });
}
