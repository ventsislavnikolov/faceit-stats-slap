import { useQuery } from "@tanstack/react-query";
import { getLiveMatches } from "~/server/matches";
import type { LiveMatch } from "~/lib/types";

export function useLiveMatches(playerIds: string[]) {
  return useQuery<LiveMatch[]>({
    queryKey: ["matches", "live", playerIds],
    queryFn: () => getLiveMatches({ data: playerIds }),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActiveMatch = data?.some((match) =>
        ["ONGOING", "READY", "VOTING", "CONFIGURING"].includes(match.status)
      );

      return hasActiveMatch ? 10_000 : 30_000;
    },
    staleTime: 20_000,
    enabled: playerIds.length > 0,
  });
}
