import { useQuery } from "@tanstack/react-query";
import { getMatchDetails } from "~/server/matches";

export function useMatchDetail(matchId: string) {
  return useQuery({
    queryKey: ["match-detail", matchId],
    queryFn: () => getMatchDetails({ data: matchId }),
    staleTime: 30_000,
  });
}
