import { useQuery } from "@tanstack/react-query";
import type { BetWithNickname } from "~/lib/types";
import { getAllBetsForMatch } from "~/server/betting";

export function useAllBetsForMatch(faceitMatchId: string) {
  return useQuery<BetWithNickname[]>({
    queryKey: ["all-bets-for-match", faceitMatchId],
    queryFn: () => getAllBetsForMatch({ data: faceitMatchId }),
    enabled: !!faceitMatchId,
    staleTime: 30_000,
  });
}
