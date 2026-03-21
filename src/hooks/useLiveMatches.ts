import { useQuery } from "@tanstack/react-query";
import { getLiveMatches } from "~/server/matches";
import type { LiveMatch } from "~/lib/types";

export function useLiveMatches() {
  return useQuery<LiveMatch[]>({
    queryKey: ["matches", "live"],
    queryFn: () => getLiveMatches(),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.length > 0 ? 30_000 : 5 * 60 * 1000;
    },
    staleTime: 20_000,
  });
}
