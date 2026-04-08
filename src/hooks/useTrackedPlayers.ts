import { useQuery } from "@tanstack/react-query";
import { getTrackedPlayers } from "~/server/tracked-players";

export function useTrackedPlayers() {
  return useQuery({
    queryKey: ["tracked-players"],
    queryFn: () => getTrackedPlayers(),
    staleTime: 60_000,
  });
}
