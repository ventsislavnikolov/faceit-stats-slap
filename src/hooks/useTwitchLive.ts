import { useQuery } from "@tanstack/react-query";
import type { TwitchStream } from "~/lib/types";

export function useTwitchLive() {
  return useQuery<TwitchStream[]>({
    queryKey: ["twitch", "live"],
    queryFn: async () => {
      const res = await fetch("/api/twitch/live");
      if (!res.ok) throw new Error("Failed to fetch Twitch streams");
      return res.json();
    },
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60_000,
  });
}
