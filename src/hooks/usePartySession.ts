import { useQuery } from "@tanstack/react-query";
import type { PartySessionData } from "~/lib/types";
import { getPartySessionStats } from "~/server/matches";

export function usePartySession(
  playerId: string | null,
  date: string | undefined
) {
  return useQuery<PartySessionData>({
    queryKey: ["party-session", playerId, date],
    queryFn: () =>
      getPartySessionStats({ data: { playerId: playerId!, date: date! } }),
    enabled: !!playerId && !!date,
    staleTime: 5 * 60 * 1000,
  });
}
