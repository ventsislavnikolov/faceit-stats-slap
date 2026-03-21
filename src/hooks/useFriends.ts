import { useQuery } from "@tanstack/react-query";
import type { FriendWithStats } from "~/lib/types";

export function useFriends() {
  return useQuery<FriendWithStats[]>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}
