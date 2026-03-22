import { useQuery } from "@tanstack/react-query";
import { getMatchDetails } from "~/server/matches";

export function useMatchStats(matchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: () => getMatchDetails({ data: matchId }),
    enabled,
    staleTime: Infinity,
  });
}
