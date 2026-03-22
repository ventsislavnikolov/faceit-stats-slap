import { useQuery } from "@tanstack/react-query";
import { getStatsLeaderboard } from "~/server/matches";
import type { StatsLeaderboardEntry } from "~/lib/types";

export function useStatsLeaderboard(playerIds: string[], n: 20 | 50 | 100) {
  return useQuery<StatsLeaderboardEntry[]>({
    queryKey: ["stats-leaderboard", playerIds, n],
    queryFn: () => getStatsLeaderboard({ data: { playerIds, n } }),
    enabled: playerIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
