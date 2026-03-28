import { useQuery } from "@tanstack/react-query";
import { getSeasonCoinBalance } from "~/server/seasons";

export function useSeasonCoinBalance(
  seasonId: string | null,
  userId: string | null
) {
  return useQuery({
    queryKey: ["season-coin-balance", seasonId, userId],
    queryFn: () =>
      getSeasonCoinBalance({
        data: { seasonId: seasonId!, userId: userId! },
      }),
    enabled: !!(seasonId && userId),
    staleTime: 30_000,
  });
}
