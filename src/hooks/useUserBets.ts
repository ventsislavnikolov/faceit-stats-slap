import { useQuery } from "@tanstack/react-query";
import type { BetHistoryItem } from "~/lib/types";
import { getUserBetHistory } from "~/server/betting";

export function useUserBets(userId: string | null) {
  return useQuery<BetHistoryItem[]>({
    queryKey: ["user-bets", userId],
    queryFn: () => getUserBetHistory({ data: userId! }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
