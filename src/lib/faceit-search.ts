const FACEIT_MATCH_ID_PATTERN =
  /^1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FaceitSearchTarget =
  | { kind: "match"; value: string }
  | { kind: "player"; value: string };

function extractFaceitNickname(input: string): string | null {
  const normalizedInput =
    input.startsWith("http://") || input.startsWith("https://")
      ? input
      : input.startsWith("faceit.com/") || input.startsWith("www.faceit.com/")
        ? `https://${input}`
        : null;

  if (!normalizedInput) {
    return null;
  }

  try {
    const url = new URL(normalizedInput);
    const hostname = url.hostname.toLowerCase();

    if (hostname !== "faceit.com" && hostname !== "www.faceit.com") {
      return null;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    const playersIndex = pathSegments.findIndex(
      (segment) => segment.toLowerCase() === "players"
    );
    const nickname = playersIndex >= 0 ? pathSegments[playersIndex + 1] : null;

    return nickname ? decodeURIComponent(nickname) : null;
  } catch {
    return null;
  }
}

export function resolveFaceitSearchTarget(input: string): FaceitSearchTarget {
  const value = input.trim();
  const nickname = extractFaceitNickname(value);

  if (FACEIT_MATCH_ID_PATTERN.test(value)) {
    return { kind: "match", value };
  }

  return { kind: "player", value: nickname ?? value };
}
