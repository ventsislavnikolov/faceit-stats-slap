import { useQuery } from "@tanstack/react-query";
import { getMatchDetails } from "~/server/matches";

interface UseMatchStatsOptions {
  enabled: boolean;
  live: boolean;
}

export function useMatchStats(matchId: string, options: UseMatchStatsOptions) {
  const { enabled, live } = options;

  return useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: () => getMatchDetails({ data: matchId }),
    enabled,
    staleTime: live ? 0 : Number.POSITIVE_INFINITY,
    refetchInterval: live ? 5_000 : false,
  });
}
