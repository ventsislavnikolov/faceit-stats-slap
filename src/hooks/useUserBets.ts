import { useQuery } from "@tanstack/react-query";
import { getUserBetHistory } from "~/server/betting";
import type { BetWithPool } from "~/lib/types";

export function useUserBets(userId: string | null) {
  return useQuery<BetWithPool[]>({
    queryKey: ["user-bets", userId],
    queryFn: () => getUserBetHistory({ data: userId! }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
