const FACEIT_MATCH_ID_PATTERN = /^1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FaceitSearchTarget =
  | { kind: "match"; value: string }
  | { kind: "player"; value: string };

export function resolveFaceitSearchTarget(input: string): FaceitSearchTarget {
  const value = input.trim();

  if (FACEIT_MATCH_ID_PATTERN.test(value)) {
    return { kind: "match", value };
  }

  return { kind: "player", value };
}
