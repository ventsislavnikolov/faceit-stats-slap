import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "~/server/betting";
import type { BettingLeaderboardEntry } from "~/lib/types";

export function useLeaderboard() {
  return useQuery<BettingLeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    staleTime: 2 * 60 * 1000,
  });
}
