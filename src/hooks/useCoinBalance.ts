import { useQuery } from "@tanstack/react-query";
import { claimDailyAllowance } from "~/server/betting";

export function useCoinBalance(userId: string | null) {
  return useQuery<number>({
    queryKey: ["coin-balance", userId],
    queryFn: async () => {
      if (!userId) return 0;
      return claimDailyAllowance({ data: userId });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
