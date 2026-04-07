import { useQuery } from "@tanstack/react-query";
import type { Bet } from "~/lib/types";
import { getUserPropBetsForMatch } from "~/server/betting";

export function useUserPropBetsForMatch(
  faceitMatchId: string,
  userId: string | null
) {
  return useQuery<Bet[]>({
    queryKey: ["user-prop-bets", faceitMatchId, userId],
    queryFn: () => getUserPropBetsForMatch({ data: { faceitMatchId, userId: userId! } }),
    enabled: !!faceitMatchId && !!userId,
    staleTime: 30_000,
  });
}
