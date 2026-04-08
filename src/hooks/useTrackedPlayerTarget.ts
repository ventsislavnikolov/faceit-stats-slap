import { useQuery } from "@tanstack/react-query";
import { isTrackedPlayerAlias } from "~/lib/tracked-player-alias";
import { resolvePlayer } from "~/server/friends";
import {
  getTrackedPlayerForFriends,
  getTrackedPlayerForHistory,
  getTrackedPlayerForLastParty,
  getTrackedPlayerForLeaderboard,
} from "~/server/tracked-player-alias";

type ResolvedTrackedPlayer = {
  faceitId: string;
  nickname: string;
};

type UseTrackedPlayerTargetInput =
  | {
      page: "friends";
      player: string | null | undefined;
      resolvedPlayerId?: string;
    }
  | {
      page: "history";
      player: string | null | undefined;
      resolvedPlayerId?: string;
      matches: 20 | 50 | 100;
      queue: "all" | "solo" | "party";
    }
  | {
      page: "leaderboard";
      player: string | null | undefined;
      resolvedPlayerId?: string;
      matches: 20 | 50 | 100;
      queue: "all" | "solo" | "party";
      last: 30 | 90 | 180 | 365 | 730;
    }
  | {
      page: "last-party";
      player: string | null | undefined;
      resolvedPlayerId?: string;
      date: string;
    };

function buildTrackedTargetQuery(params: UseTrackedPlayerTargetInput) {
  switch (params.page) {
    case "friends":
      return {
        queryKey: ["friends", params.player],
        queryFn: () => getTrackedPlayerForFriends(),
      };
    case "history":
      return {
        queryKey: [
          "history",
          params.player,
          params.matches,
          params.queue,
        ],
        queryFn: () =>
          getTrackedPlayerForHistory({
            data: {
            matches: params.matches,
            queue: params.queue,
            },
          }),
      };
    case "leaderboard":
      return {
        queryKey: [
          "leaderboard",
          params.player,
          params.matches,
          params.queue,
          params.last,
        ],
        queryFn: () =>
          getTrackedPlayerForLeaderboard({
            data: {
            matches: params.matches,
            queue: params.queue,
            last: params.last,
            },
          }),
      };
    case "last-party":
      return {
        queryKey: ["last-party", params.player, params.date],
        queryFn: () =>
          getTrackedPlayerForLastParty({
            data: {
              date: params.date,
            },
          }),
      };
  }
}

export function useTrackedPlayerTarget(params: UseTrackedPlayerTargetInput) {
  const isTrackedFlow = isTrackedPlayerAlias(params.player);
  const trackedTargetQuery = buildTrackedTargetQuery(params);
  const trackedResolution = useQuery({
    queryKey: ["tracked-player-target", ...trackedTargetQuery.queryKey],
    queryFn: trackedTargetQuery.queryFn,
    enabled: isTrackedFlow && !params.resolvedPlayerId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const directTargetLookup =
    isTrackedFlow && !params.resolvedPlayerId
      ? trackedResolution.data?.faceitId
      : params.resolvedPlayerId ?? params.player ?? null;
  const directResolution = useQuery({
    queryKey: ["resolve-player", directTargetLookup],
    queryFn: () => resolvePlayer({ data: directTargetLookup! }),
    enabled: Boolean(directTargetLookup),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const directData = directResolution.data ?? null;
  const trackedData = trackedResolution.data ?? null;
  const data: ResolvedTrackedPlayer | null =
    directData ?? trackedData ?? null;
  const isLoading =
    isTrackedFlow && !params.resolvedPlayerId
      ? trackedResolution.isLoading || (Boolean(trackedData) && directResolution.isLoading)
      : directResolution.isLoading;
  const isError =
    isTrackedFlow && !params.resolvedPlayerId
      ? trackedResolution.isError || directResolution.isError
      : directResolution.isError;

  return {
    data,
    isLoading,
    isError,
    isTrackedFlow,
  };
}
