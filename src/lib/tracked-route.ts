import {
  TRACKED_PLAYER_ALIAS,
  isTrackedPlayerAlias,
  type TrackedResolutionSearch,
} from "~/lib/tracked-player-alias";

export function getEffectiveTrackedPlayerInput(params: {
  player: string | null | undefined;
  resolvedPlayerId?: string;
}): string | null {
  const { player, resolvedPlayerId } = params;
  if (!player) {
    return null;
  }

  if (isTrackedPlayerAlias(player)) {
    return resolvedPlayerId ?? null;
  }

  return player;
}

export function getTrackedLockSearch(params: {
  player: string | null | undefined;
  resolvedPlayerId?: string;
}): TrackedResolutionSearch | undefined {
  const { player, resolvedPlayerId } = params;
  if (!isTrackedPlayerAlias(player) || !resolvedPlayerId) {
    return undefined;
  }

  return { resolvedPlayerId };
}

export function buildTrackedPlayerSearch(params: {
  currentPlayer: string | null | undefined;
  currentResolvedPlayerId?: string;
  nextPlayer?: string | null;
  nextResolvedPlayerId?: string;
}): {
  player?: string;
  resolvedPlayerId?: string;
} {
  const nextPlayer = params.nextPlayer ?? params.currentPlayer;

  if (!nextPlayer) {
    return {
      player: undefined,
      resolvedPlayerId: undefined,
    };
  }

  if (!isTrackedPlayerAlias(nextPlayer)) {
    return {
      player: nextPlayer,
      resolvedPlayerId: undefined,
    };
  }

  return {
    player: TRACKED_PLAYER_ALIAS,
    resolvedPlayerId:
      params.nextResolvedPlayerId ??
      (params.nextPlayer == null ? params.currentResolvedPlayerId : undefined),
  };
}
