import { useQuery } from "@tanstack/react-query";
import type { PartySessionData } from "~/lib/types";
import { getPartySessionStats } from "~/server/matches";

export function usePartySession(
  playerId: string | null,
  date: string | undefined,
  includeAllTeammates = false
) {
  return useQuery<PartySessionData>({
    queryKey: ["party-session", playerId, date, includeAllTeammates],
    queryFn: () =>
      getPartySessionStats({
        data: { playerId: playerId!, date: date!, includeAllTeammates },
      }),
    enabled: !!playerId && !!date,
    staleTime: 5 * 60 * 1000,
  });
}
