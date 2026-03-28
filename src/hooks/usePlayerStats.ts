import { useQuery } from "@tanstack/react-query";
import type { PlayerHistoryMatch } from "~/lib/types";
import { getPlayerStats } from "~/server/matches";

export function usePlayerStats(
  playerId: string | null,
  n = 15,
  queue: "all" | "solo" | "party" = "all"
) {
  return useQuery<PlayerHistoryMatch[]>({
    queryKey: ["stats", playerId, n, queue],
    queryFn: () => getPlayerStats({ data: { playerId: playerId!, n, queue } }),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}
