import { useQuery } from "@tanstack/react-query";
import { getCoinBalance } from "~/server/betting";

export function useCoinBalance(userId: string | null) {
  return useQuery<number>({
    queryKey: ["coin-balance", userId],
    queryFn: () => getCoinBalance({ data: userId! }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
