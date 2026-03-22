import type { LiveMatch, TwitchStream } from "./types";

export function getPlayingFriendIds(
  liveMatches: LiveMatch[],
  twitchStreams: TwitchStream[]
): Set<string> {
  return new Set([
    ...liveMatches.flatMap((match) => match.friendIds),
    ...twitchStreams.filter((stream) => stream.isLive).map((stream) => stream.faceitId),
  ]);
}
