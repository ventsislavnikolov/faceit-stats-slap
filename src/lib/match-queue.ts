import type { MatchQueueBucket } from "./types";

export const PARTY_FRIEND_THRESHOLD = 2;

type QueueMatchTeam =
  | {
      players?: Array<{
        player_id?: string | null;
      }> | null;
    }
  | null
  | undefined;

export function classifyKnownFriendQueue(params: {
  targetPlayerId: string;
  targetFriendIds: string[] | null;
  teams: QueueMatchTeam[];
}): {
  queueBucket: MatchQueueBucket;
  knownQueuedFriendCount: number;
  knownQueuedFriendIds: string[];
  partySize: number | null;
} {
  const { targetPlayerId, targetFriendIds, teams } = params;

  if (!targetFriendIds) {
    return {
      queueBucket: "unknown",
      knownQueuedFriendCount: 0,
      knownQueuedFriendIds: [],
      partySize: null,
    };
  }

  const friendIdSet = new Set(targetFriendIds);

  for (const team of teams) {
    const playerIds = (team?.players ?? [])
      .map((player) => player?.player_id)
      .filter((playerId): playerId is string => typeof playerId === "string");

    if (!playerIds.includes(targetPlayerId)) {
      continue;
    }

    const knownQueuedFriendIds = [
      ...new Set(
        playerIds.filter(
          (playerId) => playerId !== targetPlayerId && friendIdSet.has(playerId)
        )
      ),
    ];
    const knownQueuedFriendCount = knownQueuedFriendIds.length;

    return {
      queueBucket:
        knownQueuedFriendCount >= PARTY_FRIEND_THRESHOLD ? "party" : "solo",
      knownQueuedFriendCount,
      knownQueuedFriendIds,
      partySize: knownQueuedFriendCount + 1,
    };
  }

  return {
    queueBucket: "unknown",
    knownQueuedFriendCount: 0,
    knownQueuedFriendIds: [],
    partySize: null,
  };
}
