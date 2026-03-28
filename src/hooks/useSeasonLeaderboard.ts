import { useQuery } from "@tanstack/react-query";
import { getSeasonLeaderboard } from "~/server/seasons";

export function useSeasonLeaderboard(seasonId: string | null) {
  return useQuery({
    queryKey: ["season-leaderboard", seasonId],
    queryFn: () => getSeasonLeaderboard({ data: seasonId! }),
    enabled: !!seasonId,
    staleTime: 30_000,
  });
}
