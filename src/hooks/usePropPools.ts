import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getPropPoolsForMatch } from "~/server/betting";

const subscribeToPropPools = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (faceitMatchId: string, onUpdate: () => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const channel = getSupabaseClient()
      .channel(`props-${faceitMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prop_pools",
          filter: `faceit_match_id=eq.${faceitMatchId}`,
        },
        onUpdate
      )
      .subscribe();
    return channel;
  });

export function usePropPools(faceitMatchId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["prop-pools", faceitMatchId];

  const query = useQuery({
    queryKey,
    queryFn: () => getPropPoolsForMatch({ data: faceitMatchId }),
    enabled: !!faceitMatchId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!faceitMatchId) {
      return;
    }
    let channel: any;
    subscribeToPropPools(faceitMatchId, () => {
      queryClient.invalidateQueries({ queryKey });
    }).then((ch) => {
      channel = ch;
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [faceitMatchId, queryClient]);

  return query;
}
