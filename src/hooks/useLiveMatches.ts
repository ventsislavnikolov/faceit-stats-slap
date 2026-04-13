import { useQuery } from "@tanstack/react-query";
import type { LiveMatch } from "~/lib/types";
import { getLiveMatches } from "~/server/matches";

export function useLiveMatches(playerIds: string[]) {
  return useQuery<LiveMatch[]>({
    queryKey: ["matches", "live", playerIds],
    queryFn: () => getLiveMatches({ data: playerIds }),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActiveMatch = data?.some((match) =>
        ["ONGOING", "READY", "VOTING", "CONFIGURING"].includes(match.status)
      );

      return hasActiveMatch ? 5_000 : 15_000;
    },
    staleTime: 10_000,
    enabled: playerIds.length > 0,
  });
}
