import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAllPlayerHistory } from "~/server/matches";

export function useSyncPlayerHistory(playerIds: string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (n: 20 | 50 | 100) =>
      syncAllPlayerHistory({ data: { playerIds, n } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-leaderboard"] });
    },
  });
}
