import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAllPlayerHistory } from "~/server/matches";

export function useSyncPlayerHistory(params: {
  targetPlayerId: string;
  playerIds: string[];
}) {
  const { targetPlayerId, playerIds } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { n: 20 | 50 | 100; days: 30 | 90 | 180 | 365 | 730 }) =>
      syncAllPlayerHistory({ data: { targetPlayerId, playerIds, n: input.n, days: input.days } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-leaderboard"] });
    },
  });
}
