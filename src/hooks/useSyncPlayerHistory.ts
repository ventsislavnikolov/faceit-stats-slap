import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAllPlayerHistory } from "~/server/matches";

export function useSyncPlayerHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (n: 20 | 50 | 100) => syncAllPlayerHistory({ data: n }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-leaderboard"] });
    },
  });
}
