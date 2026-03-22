import { useQuery } from "@tanstack/react-query";
import { getStatsLeaderboard } from "~/server/matches";
import type { StatsLeaderboardEntry } from "~/lib/types";

export function useStatsLeaderboard(n: 20 | 50 | 100) {
  return useQuery<StatsLeaderboardEntry[]>({
    queryKey: ["stats-leaderboard", n],
    queryFn: () => getStatsLeaderboard({ data: n }),
    staleTime: 5 * 60 * 1000,
  });
}
