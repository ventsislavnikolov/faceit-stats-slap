import { useQuery } from "@tanstack/react-query";
import { getTwitchStreams } from "~/server/twitch";
import type { TwitchStream } from "~/lib/types";

export function useTwitchLive() {
  return useQuery<TwitchStream[]>({
    queryKey: ["twitch", "live"],
    queryFn: () => getTwitchStreams(),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60_000,
  });
}
