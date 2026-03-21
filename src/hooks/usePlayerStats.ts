import { useQuery } from "@tanstack/react-query";
import type { MatchWithStats } from "~/lib/types";

export function usePlayerStats(playerId: string | null) {
  return useQuery<MatchWithStats[]>({
    queryKey: ["stats", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/${playerId}`);
      if (!res.ok) throw new Error("Failed to fetch player stats");
      return res.json();
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}
