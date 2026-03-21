import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCoinBalance, claimDailyAllowance } from "~/server/betting";

export function useCoinBalance(userId: string | null) {
  // Claim daily allowance once on mount (no-ops if already claimed today)
  useEffect(() => {
    if (!userId) return;
    claimDailyAllowance({ data: userId }).catch(() => {});
  }, [userId]);

  return useQuery<number>({
    queryKey: ["coin-balance", userId],
    queryFn: async () => {
      if (!userId) return 0;
      return getCoinBalance({ data: userId });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
