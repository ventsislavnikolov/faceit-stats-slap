export const TRACKED_PLAYER_ALIAS = "tracked";

export function isTrackedPlayerAlias(
  input: string | null | undefined
): boolean {
  return input?.trim().toLowerCase() === TRACKED_PLAYER_ALIAS;
}

export type TrackedResolutionSearch = {
  resolvedPlayerId?: string;
};

export function normalizeTrackedResolvedPlayerId(
  input: unknown
): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
