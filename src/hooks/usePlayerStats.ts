import { useQuery } from "@tanstack/react-query";
import { getPlayerStats } from "~/server/matches";
import type { MatchWithStats } from "~/lib/types";

export function usePlayerStats(playerId: string | null) {
  return useQuery<MatchWithStats[]>({
    queryKey: ["stats", playerId],
    queryFn: () => getPlayerStats({ data: playerId! }),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}
