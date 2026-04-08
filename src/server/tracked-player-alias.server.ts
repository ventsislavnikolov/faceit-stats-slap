import {
  findCurrentlyLiveTrackedPlayers,
  findLatestHistoryPlayedAt,
  findLatestLeaderboardPlayedAt,
  findLatestPartySessionPlayedAt,
  findLatestRecentMatchesPlayedAt,
} from "~/server/tracked-player-selectors.server";
import { loadTrackedPlayersSnapshot } from "~/server/tracked-players.server";

type ResolvedTrackedPlayer = {
  faceitId: string;
  nickname: string;
};
const TRACKED_SELECTOR_CONCURRENCY = 2;

function pickNewestCandidate<
  T extends ResolvedTrackedPlayer & { latestPlayedAt: string | null },
>(candidates: T[]): ResolvedTrackedPlayer | null {
  const freshest = candidates
    .filter((candidate) => candidate.latestPlayedAt)
    .sort((a, b) =>
      (b.latestPlayedAt ?? "").localeCompare(a.latestPlayedAt ?? "")
    )[0];

  if (!freshest) {
    return null;
  }

  return {
    faceitId: freshest.faceitId,
    nickname: freshest.nickname,
  };
}

function orderTrackedPlayersByRecentActivity(
  trackedPlayers: ResolvedTrackedPlayer[],
  recentByPlayer: Map<string, string>
): ResolvedTrackedPlayer[] {
  return [...trackedPlayers].sort((a, b) =>
    (recentByPlayer.get(b.faceitId) ?? "").localeCompare(
      recentByPlayer.get(a.faceitId) ?? ""
    )
  );
}

async function resolveTrackedPlayerWithSelector(
  trackedPlayers: ResolvedTrackedPlayer[],
  resolvePlayedAt: (player: ResolvedTrackedPlayer) => Promise<string | null>
): Promise<ResolvedTrackedPlayer | null> {
  const recentByPlayer = await findLatestRecentMatchesPlayedAt(
    trackedPlayers.map((player) => player.faceitId)
  );
  const orderedPlayers = orderTrackedPlayersByRecentActivity(
    trackedPlayers,
    recentByPlayer
  );
  const candidates: Array<
    ResolvedTrackedPlayer & { latestPlayedAt: string | null }
  > = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < orderedPlayers.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const player = orderedPlayers[currentIndex];
      if (!player) {
        return;
      }

      candidates.push({
        ...player,
        latestPlayedAt: await resolvePlayedAt(player),
      });
    }
  }

  const workerCount = Math.min(
    TRACKED_SELECTOR_CONCURRENCY,
    orderedPlayers.length
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return pickNewestCandidate(candidates);
}

export async function resolveTrackedPlayerForFriends(): Promise<ResolvedTrackedPlayer | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) {
    return null;
  }

  const livePlayerIds = await findCurrentlyLiveTrackedPlayers(
    trackedPlayers.map((player) => player.faceitId)
  );
  const livePlayer = trackedPlayers.find((player) =>
    livePlayerIds.includes(player.faceitId)
  );
  if (livePlayer) {
    return {
      faceitId: livePlayer.faceitId,
      nickname: livePlayer.nickname,
    };
  }

  const recentByPlayer = await findLatestRecentMatchesPlayedAt(
    trackedPlayers.map((player) => player.faceitId)
  );
  const candidates = trackedPlayers.map((player) => ({
    ...player,
    latestPlayedAt: recentByPlayer.get(player.faceitId) ?? null,
  }));

  return pickNewestCandidate(candidates);
}

export async function resolveTrackedPlayerForHistory(input: {
  matches: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
}): Promise<ResolvedTrackedPlayer | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) {
    return null;
  }

  return resolveTrackedPlayerWithSelector(trackedPlayers, (player) =>
    findLatestHistoryPlayedAt({
      playerId: player.faceitId,
      n: input.matches,
      queue: input.queue,
    })
  );
}

export async function resolveTrackedPlayerForLeaderboard(input: {
  matches: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
  last: 30 | 90 | 180 | 365 | 730;
}): Promise<ResolvedTrackedPlayer | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) {
    return null;
  }

  return resolveTrackedPlayerWithSelector(trackedPlayers, (player) =>
    findLatestLeaderboardPlayedAt({
      targetPlayerId: player.faceitId,
      n: input.matches,
      days: input.last,
      queue: input.queue,
    })
  );
}

export async function resolveTrackedPlayerForLastParty(input: {
  date: string;
}): Promise<ResolvedTrackedPlayer | null> {
  const trackedPlayers = await loadTrackedPlayersSnapshot();
  if (trackedPlayers.length === 0) {
    return null;
  }

  return resolveTrackedPlayerWithSelector(trackedPlayers, (player) =>
    findLatestPartySessionPlayedAt({
      playerId: player.faceitId,
      date: input.date,
    })
  );
}
