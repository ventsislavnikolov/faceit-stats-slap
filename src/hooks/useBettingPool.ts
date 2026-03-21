import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { BettingPool, Bet } from "~/lib/types";

export function useBettingPool(faceitMatchId: string, userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["betting-pool", faceitMatchId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { getSupabaseClient } = await import("~/lib/supabase.client");
      const supabase = getSupabaseClient();

      const { data: poolRow } = await supabase
        .from("betting_pools")
        .select("*")
        .eq("faceit_match_id", faceitMatchId)
        .single();

      if (!poolRow) return { pool: null, userBet: null };

      let userBet: Bet | null = null;
      if (userId) {
        const { data: betRow } = await supabase
          .from("bets")
          .select("*")
          .eq("pool_id", poolRow.id)
          .eq("user_id", userId)
          .single();
        if (betRow) {
          userBet = {
            id: betRow.id,
            poolId: betRow.pool_id,
            userId: betRow.user_id,
            side: betRow.side,
            amount: betRow.amount,
            payout: betRow.payout,
            createdAt: betRow.created_at,
          };
        }
      }

      const pool: BettingPool = {
        id: poolRow.id,
        faceitMatchId: poolRow.faceit_match_id,
        status: poolRow.status,
        team1Name: poolRow.team1_name,
        team2Name: poolRow.team2_name,
        team1Pool: poolRow.team1_pool,
        team2Pool: poolRow.team2_pool,
        winningTeam: poolRow.winning_team,
        opensAt: poolRow.opens_at,
        closesAt: poolRow.closes_at,
        resolvedAt: poolRow.resolved_at,
      };

      return { pool, userBet };
    },
    staleTime: 30_000,
    enabled: !!faceitMatchId,
  });

  // Supabase Realtime subscription for live pool updates
  useEffect(() => {
    if (!faceitMatchId) return;
    let channel: any;
    import("~/lib/supabase.client").then(({ getSupabaseClient }) => {
      channel = getSupabaseClient()
        .channel(`pool-${faceitMatchId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "betting_pools",
            filter: `faceit_match_id=eq.${faceitMatchId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey });
          }
        )
        .subscribe();
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [faceitMatchId, queryClient]);

  return query;
}
