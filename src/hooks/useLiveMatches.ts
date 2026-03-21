import { useQuery } from "@tanstack/react-query";
import type { LiveMatch } from "~/lib/types";

export function useLiveMatches() {
  return useQuery<LiveMatch[]>({
    queryKey: ["matches", "live"],
    queryFn: async () => {
      const res = await fetch("/api/matches/live");
      if (!res.ok) throw new Error("Failed to fetch live matches");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.length > 0 ? 30_000 : 5 * 60 * 1000;
    },
    staleTime: 20_000,
  });
}
