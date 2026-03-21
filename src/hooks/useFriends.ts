import { useQuery } from "@tanstack/react-query";
import { getFriends } from "~/server/friends";
import type { FriendWithStats } from "~/lib/types";

export function useFriends() {
  return useQuery<FriendWithStats[]>({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}
