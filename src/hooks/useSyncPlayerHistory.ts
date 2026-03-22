import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAllPlayerHistory } from "~/server/matches";

export function useSyncPlayerHistory(params: {
  targetPlayerId: string;
  playerIds: string[];
}) {
  const { targetPlayerId, playerIds } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (n: 20 | 50 | 100) =>
      syncAllPlayerHistory({ data: { targetPlayerId, playerIds, n } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-leaderboard"] });
    },
  });
}
