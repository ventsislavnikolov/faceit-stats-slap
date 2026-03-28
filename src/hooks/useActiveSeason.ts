import { useQuery } from "@tanstack/react-query";
import { getActiveSeason } from "~/server/seasons";

export function useActiveSeason() {
  return useQuery({
    queryKey: ["active-season"],
    queryFn: () => getActiveSeason(),
    staleTime: 60_000,
  });
}
