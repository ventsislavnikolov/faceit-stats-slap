import { useQuery } from "@tanstack/react-query";
import type { BettingLeaderboardEntry } from "~/lib/types";
import { getLeaderboard } from "~/server/betting";

export function useLeaderboard() {
  return useQuery<BettingLeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    staleTime: 2 * 60 * 1000,
  });
}
