import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getBettingPool, getUserBetForMatch } from "~/server/betting";
import type { BettingPool, Bet } from "~/lib/types";

const subscribeToPool = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (faceitMatchId: string, onUpdate: () => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const channel = getSupabaseClient()
      .channel(`pool-${faceitMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "betting_pools",
          filter: `faceit_match_id=eq.${faceitMatchId}`,
        },
        onUpdate
      )
      .subscribe();
    return channel;
  });

export function useBettingPool(faceitMatchId: string, userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["betting-pool", faceitMatchId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<{ pool: BettingPool | null; userBet: Bet | null }> => {
      const { pool } = await getBettingPool({ data: faceitMatchId });

      if (!pool) return { pool: null, userBet: null };

      let userBet: Bet | null = null;
      if (userId) {
        userBet = await getUserBetForMatch({ data: { faceitMatchId, userId } });
      }

      return { pool, userBet };
    },
    staleTime: 30_000,
    enabled: !!faceitMatchId,
  });

  useEffect(() => {
    if (!faceitMatchId) return;
    let channel: any;
    subscribeToPool(faceitMatchId, () => {
      queryClient.invalidateQueries({ queryKey });
    }).then((ch) => { channel = ch; });
    return () => {
      channel?.unsubscribe();
    };
  }, [faceitMatchId, queryClient]);

  return query;
}
