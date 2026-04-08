import {
  fetchMatchStats,
  fetchPlayer,
  fetchPlayerHistory,
} from "~/lib/faceit";
import { classifyKnownFriendQueue } from "~/lib/match-queue";
import type { SharedStatsLeaderboardRow } from "~/lib/stats-leaderboard";
import { createServerSupabase } from "~/lib/supabase.server";
import { getWebhookLiveMatchMap } from "~/server/faceit-webhooks";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATS_LEADERBOARD_ROW_SELECT =
  "match_id, faceit_player_id, nickname, played_at, kills, kd_ratio, adr, hs_percent, kr_ratio, win, first_kills, clutch_kills, utility_damage, enemies_flashed, entry_count, entry_wins, sniper_kills";
const STATS_LEADERBOARD_PAGE_SIZE = 1000;
const STATS_LEADERBOARD_MATCH_CHUNK_SIZE = 50;

function toIsoFromUnix(timestamp: number | null | undefined): string | null {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

async function fetchPlayerHistoryRange(params: {
  faceitId: string;
  startUnix: number;
  endUnix: number;
}): Promise<any[]> {
  const { faceitId, startUnix, endUnix } = params;
  const history: any[] = [];

  for (let page = 0; ; page += 1) {
    const pageHistory = await fetchPlayerHistory(faceitId, 100, page * 100);
    if (pageHistory.length === 0) {
      break;
    }

    let shouldStop = false;
    for (const item of pageHistory) {
      const rawTimestamp = item?.finished_at ?? item?.started_at;
      const timestamp =
        typeof rawTimestamp === "number" ? rawTimestamp : Number(rawTimestamp);
      if (!Number.isFinite(timestamp)) {
        continue;
      }

      if (timestamp > endUnix) {
        continue;
      }
      if (timestamp < startUnix) {
        shouldStop = true;
        continue;
      }

      history.push(item);
    }

    if (shouldStop || pageHistory.length < 100) {
      break;
    }
  }

  return history;
}

function buildLeaderboardQueueKey(matchId: string, faceitId: string): string {
  return `${matchId}:${faceitId}`;
}

function classifyLeaderboardQueueBuckets(params: {
  rows: SharedStatsLeaderboardRow[];
}): Map<string, "solo" | "party"> {
  const { rows } = params;
  const buckets = new Map<string, "solo" | "party">();
  const rowPlayerIdsByMatch = new Map<string, Set<string>>();

  for (const row of rows) {
    const existingPlayerIds =
      rowPlayerIdsByMatch.get(row.matchId) ?? new Set<string>();
    existingPlayerIds.add(row.faceitId);
    rowPlayerIdsByMatch.set(row.matchId, existingPlayerIds);
  }

  for (const row of rows) {
    const cohortPlayersInMatch =
      rowPlayerIdsByMatch.get(row.matchId) ?? new Set<string>();
    const otherCohortPlayers = [...cohortPlayersInMatch].filter(
      (faceitId) => faceitId !== row.faceitId
    );

    buckets.set(
      buildLeaderboardQueueKey(row.matchId, row.faceitId),
      otherCohortPlayers.length >= 2 ? "party" : "solo"
    );
  }

  return buckets;
}

function normalizeStatsLeaderboardRows(rows: any[]): SharedStatsLeaderboardRow[] {
  return rows.map((row: any) => ({
    matchId: row.match_id,
    playedAt: row.played_at,
    faceitId: row.faceit_player_id,
    nickname: row.nickname || row.faceit_player_id,
    elo: 0,
    kills: Number(row.kills) || 0,
    kdRatio: Number(row.kd_ratio) || 0,
    adr: Number(row.adr) || 0,
    hsPercent: Number(row.hs_percent) || 0,
    krRatio: Number(row.kr_ratio) || 0,
    win: Boolean(row.win),
    firstKills: Number(row.first_kills) || 0,
    clutchKills: Number(row.clutch_kills) || 0,
    utilityDamage: Number(row.utility_damage) || 0,
    enemiesFlashed: Number(row.enemies_flashed) || 0,
    entryCount: Number(row.entry_count) || 0,
    entryWins: Number(row.entry_wins) || 0,
    sniperKills: Number(row.sniper_kills) || 0,
  }));
}

function dedupeStatsLeaderboardRows(
  rows: SharedStatsLeaderboardRow[]
): SharedStatsLeaderboardRow[] {
  const seen = new Set<string>();
  const deduped: SharedStatsLeaderboardRow[] = [];

  for (const row of rows) {
    const key = `${row.matchId}:${row.faceitId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

async function fetchTargetStatsLeaderboardRows(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  targetPlayerId: string;
  days: 30 | 90 | 180 | 365 | 730;
}): Promise<any[]> {
  const { supabase, targetPlayerId, days } = params;
  const cutoffIso = new Date(Date.now() - days * DAY_MS).toISOString();
  const rows: any[] = [];

  for (let from = 0; ; from += STATS_LEADERBOARD_PAGE_SIZE) {
    const to = from + STATS_LEADERBOARD_PAGE_SIZE - 1;
    const { data: pageRows } = await supabase
      .from("match_player_stats")
      .select(STATS_LEADERBOARD_ROW_SELECT)
      .eq("faceit_player_id", targetPlayerId)
      .gte("played_at", cutoffIso)
      .order("played_at", { ascending: false })
      .range(from, to);

    if (!pageRows?.length) {
      break;
    }

    rows.push(...pageRows);
    if (pageRows.length < STATS_LEADERBOARD_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchStatsLeaderboardRowsForMatches(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  matchIds: string[];
}): Promise<any[]> {
  const { supabase, matchIds } = params;
  if (matchIds.length === 0) {
    return [];
  }

  const rows: any[] = [];

  for (
    let index = 0;
    index < matchIds.length;
    index += STATS_LEADERBOARD_MATCH_CHUNK_SIZE
  ) {
    const matchIdChunk = matchIds.slice(
      index,
      index + STATS_LEADERBOARD_MATCH_CHUNK_SIZE
    );
    const { data: sharedRows } = await supabase
      .from("match_player_stats")
      .select(STATS_LEADERBOARD_ROW_SELECT)
      .in("match_id", matchIdChunk);

    rows.push(...(sharedRows ?? []));
  }

  return rows;
}

export async function findLatestHistoryPlayedAt(input: {
  playerId: string;
  n: 20 | 50 | 100;
  queue: "all" | "solo" | "party";
}): Promise<string | null> {
  const targetFriendIds = await fetchPlayer(input.playerId)
    .then((player) => player.friendsIds)
    .catch(() => null);
  const pageSize = Math.max(input.n, 20);

  for (let offset = 0; ; offset += pageSize) {
    const history = await fetchPlayerHistory(input.playerId, pageSize, offset);
    if (history.length === 0) {
      break;
    }

    for (const item of history) {
      const stats = await fetchMatchStats(item.match_id).catch(() => null);
      const round = stats?.rounds?.[0];
      if (!round) {
        continue;
      }

      const queueInfo = classifyKnownFriendQueue({
        targetPlayerId: input.playerId,
        targetFriendIds,
        teams: round.teams || [],
      });

      if (input.queue !== "all" && queueInfo.queueBucket !== input.queue) {
        continue;
      }

      const targetFound = (round.teams || []).some((team: any) =>
        (team.players || []).some(
          (player: any) => player.player_id === input.playerId
        )
      );
      if (!targetFound) {
        continue;
      }

      return toIsoFromUnix(item.finished_at ?? item.started_at);
    }

    if (history.length < pageSize) {
      break;
    }
  }

  return null;
}

export async function findLatestLeaderboardPlayedAt(input: {
  targetPlayerId: string;
  n: 20 | 50 | 100;
  days: 30 | 90 | 180 | 365 | 730;
  queue: "all" | "solo" | "party";
}): Promise<string | null> {
  const supabase = createServerSupabase();
  const targetRows = await fetchTargetStatsLeaderboardRows({
    supabase,
    targetPlayerId: input.targetPlayerId,
    days: input.days,
  });
  const targetRowsWithPlayedAt = targetRows.filter(
    (row) => typeof row.played_at === "string" && row.played_at.length > 0
  );
  if (targetRowsWithPlayedAt.length === 0) {
    return null;
  }
  if (input.queue === "all") {
    return targetRowsWithPlayedAt[0]?.played_at ?? null;
  }

  const supportRows = await fetchStatsLeaderboardRowsForMatches({
    supabase,
    matchIds: [
      ...new Set(targetRowsWithPlayedAt.map((row: any) => row.match_id)),
    ],
  });
  const normalizedRows = dedupeStatsLeaderboardRows(
    normalizeStatsLeaderboardRows([...targetRowsWithPlayedAt, ...supportRows])
  );
  const queueBuckets = classifyLeaderboardQueueBuckets({
    rows: normalizedRows,
  });

  const latestPlayedAt = normalizedRows
    .filter((row) => row.faceitId === input.targetPlayerId)
    .filter(
      (row) =>
        queueBuckets.get(buildLeaderboardQueueKey(row.matchId, row.faceitId)) ===
        input.queue
    )
    .map((row) => row.playedAt)
    .filter((playedAt): playedAt is string => Boolean(playedAt))
    .sort((a, b) => b.localeCompare(a))[0];

  return latestPlayedAt ?? null;
}

export async function findLatestPartySessionPlayedAt(input: {
  playerId: string;
  date: string;
}): Promise<string | null> {
  const { getCalendarDayRange } = await import("~/lib/time");
  const targetFriendIds = await fetchPlayer(input.playerId)
    .then((player) => player.friendsIds)
    .catch(() => null);
  const { startUnix, endUnix } = getCalendarDayRange(input.date);
  const history = await fetchPlayerHistoryRange({
    faceitId: input.playerId,
    startUnix,
    endUnix,
  });

  for (const item of history) {
    const stats = await fetchMatchStats(item.match_id).catch(() => null);
    const round = stats?.rounds?.[0];
    if (!round) {
      continue;
    }

    const queueInfo = classifyKnownFriendQueue({
      targetPlayerId: input.playerId,
      targetFriendIds,
      teams: round.teams || [],
    });

    if (queueInfo.queueBucket === "party") {
      return toIsoFromUnix(item.started_at ?? item.finished_at);
    }
  }

  return null;
}

export async function findLatestRecentMatchPlayedAt(
  playerId: string
): Promise<string | null> {
  const recentMatches = await findLatestRecentMatchesPlayedAt([playerId]);
  return recentMatches.get(playerId) ?? null;
}

export async function findLatestRecentMatchesPlayedAt(
  playerIds: string[]
): Promise<Map<string, string>> {
  const uniquePlayerIds = [...new Set(playerIds)];
  if (uniquePlayerIds.length === 0) {
    return new Map();
  }

  const supabase = createServerSupabase();
  const latestByPlayer = new Map<string, string>();

  for (
    let from = 0;
    latestByPlayer.size < uniquePlayerIds.length;
    from += STATS_LEADERBOARD_PAGE_SIZE
  ) {
    const to = from + STATS_LEADERBOARD_PAGE_SIZE - 1;
    const { data } = await supabase
      .from("match_player_stats")
      .select("faceit_player_id, played_at")
      .in("faceit_player_id", uniquePlayerIds)
      .not("played_at", "is", null)
      .order("played_at", { ascending: false })
      .range(from, to);

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      if (
        typeof row.played_at === "string" &&
        row.played_at.length > 0 &&
        !latestByPlayer.has(row.faceit_player_id)
      ) {
        latestByPlayer.set(row.faceit_player_id, row.played_at);
      }
    }

    if (data.length < STATS_LEADERBOARD_PAGE_SIZE) {
      break;
    }
  }

  return latestByPlayer;
}

export async function findCurrentlyLiveTrackedPlayers(
  playerIds: string[]
): Promise<string[]> {
  if (playerIds.length === 0) {
    return [];
  }

  const liveMatchMap = await getWebhookLiveMatchMap(playerIds);
  return [...new Set([...liveMatchMap.values()].flat())];
}
