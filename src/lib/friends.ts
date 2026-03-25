import type { LiveMatch, TwitchStream } from "./types";

export function getPlayingFriendIds(
  liveMatches: LiveMatch[],
  twitchStreams: TwitchStream[]
): Set<string> {
  const activeStatuses = new Set(["ONGOING", "READY", "VOTING", "CONFIGURING"]);

  return new Set([
    ...liveMatches
      .filter((match) => activeStatuses.has(match.status))
      .flatMap((match) => match.friendIds),
    ...twitchStreams
      .filter((stream) => stream.isLive)
      .map((stream) => stream.faceitId),
  ]);
}
