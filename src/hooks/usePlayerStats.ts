import { useQuery } from "@tanstack/react-query";
import { getPlayerStats } from "~/server/matches";
import type { PlayerHistoryMatch } from "~/lib/types";

export function usePlayerStats(
  playerId: string | null,
  n: "yesterday" | number = 15,
  queue: "all" | "solo" | "party" = "all"
) {
  return useQuery<PlayerHistoryMatch[]>({
    queryKey: ["stats", playerId, n, queue],
    queryFn: () => getPlayerStats({ data: { playerId: playerId!, n, queue } }),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}
