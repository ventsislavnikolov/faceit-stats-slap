export const TRACKED_PLAYER_ALIAS = "tracked";

export function isTrackedPlayerAlias(
  input: string | null | undefined
): boolean {
  return input?.trim().toLowerCase() === TRACKED_PLAYER_ALIAS;
}

export type TrackedResolutionSearch = {
  resolvedPlayerId?: string;
};
