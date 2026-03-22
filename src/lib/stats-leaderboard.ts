import type { StatsLeaderboardEntry } from "~/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SharedStatsLeaderboardRow {
  matchId: string;
  playedAt: string | number | Date | null | undefined;
  faceitId: string;
  nickname: string;
  elo: number;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  krRatio: number;
  win: boolean;
  firstKills: number;
  clutchKills: number;
  utilityDamage: number;
  enemiesFlashed: number;
  entryCount: number;
  entryWins: number;
  sniperKills: number;
}

interface ValidSharedStatsLeaderboardRow extends SharedStatsLeaderboardRow {
  playedAtMs: number;
}

export interface StatsLeaderboardResult {
  entries: StatsLeaderboardEntry[];
  targetMatchCount: number;
  sharedFriendCount: number;
}

export interface BuildSharedStatsLeaderboardInput {
  rows: SharedStatsLeaderboardRow[];
  targetPlayerId: string;
  friendIds: string[];
  n: number;
  days: number;
  now?: string | number | Date;
}

function toTimestamp(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(rows: SharedStatsLeaderboardRow[], selector: (row: SharedStatsLeaderboardRow) => number): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + (Number(selector(row)) || 0), 0);
  return sum / rows.length;
}

function averageRounded(
  rows: SharedStatsLeaderboardRow[],
  selector: (row: SharedStatsLeaderboardRow) => number,
  decimals: number
): number {
  return round(average(rows, selector), decimals);
}

function normalizeRow(row: SharedStatsLeaderboardRow): ValidSharedStatsLeaderboardRow | null {
  const playedAtMs = toTimestamp(row.playedAt);
  if (playedAtMs == null) return null;
  return { ...row, playedAtMs };
}

export type BuildPersonalFormLeaderboardInput = BuildSharedStatsLeaderboardInput;

export function buildPersonalFormLeaderboard({
  rows,
  targetPlayerId,
  friendIds,
  n,
  days,
  now = Date.now(),
}: BuildSharedStatsLeaderboardInput): StatsLeaderboardResult {
  const cutoff = toTimestamp(now) - days * DAY_MS;
  const friendSet = new Set(friendIds.filter((id) => id !== targetPlayerId));
  const rowsByMatch = new Map<string, ValidSharedStatsLeaderboardRow[]>();
  const targetMatchIds = new Set<string>();

  for (const row of rows) {
    const validRow = normalizeRow(row);
    if (!validRow) continue;

    if (!rowsByMatch.has(validRow.matchId)) rowsByMatch.set(validRow.matchId, []);
    rowsByMatch.get(validRow.matchId)!.push(validRow);

    if (validRow.faceitId === targetPlayerId && validRow.playedAtMs >= cutoff) {
      targetMatchIds.add(row.matchId);
    }
  }

  const eligibleFriendIds = new Set<string>();
  for (const matchId of targetMatchIds) {
    const matchRows = rowsByMatch.get(matchId) ?? [];
    for (const row of matchRows) {
      if (friendSet.has(row.faceitId)) {
        eligibleFriendIds.add(row.faceitId);
      }
    }
  }

  const includedPlayerIds = new Set(eligibleFriendIds);
  if (targetMatchIds.size > 0) {
    includedPlayerIds.add(targetPlayerId);
  }

  const perFriendRows = new Map<string, ValidSharedStatsLeaderboardRow[]>();
  for (const row of rows) {
    const validRow = normalizeRow(row);
    if (!validRow || !includedPlayerIds.has(validRow.faceitId)) continue;

    if (!perFriendRows.has(validRow.faceitId)) perFriendRows.set(validRow.faceitId, []);
    perFriendRows.get(validRow.faceitId)!.push(validRow);
  }

  const entries = [...perFriendRows.entries()]
    .map(([faceitId, personalRows]) => {
      const recentPersonalRows = [...personalRows]
        .sort((a, b) => b.playedAtMs - a.playedAtMs)
        .slice(0, n);

      if (recentPersonalRows.length === 0) return null;

      const latest = recentPersonalRows[0];
      const wins = recentPersonalRows.filter((row) => row.win).length;
      const totalEntryCount = recentPersonalRows.reduce((sum, row) => sum + (Number(row.entryCount) || 0), 0);
      const totalEntryWins = recentPersonalRows.reduce((sum, row) => sum + (Number(row.entryWins) || 0), 0);

      return {
        faceitId,
        nickname: latest.nickname || faceitId,
        elo: Number(latest.elo) || 0,
        gamesPlayed: recentPersonalRows.length,
        avgKd: averageRounded(recentPersonalRows, (row) => row.kdRatio, 2),
        avgAdr: averageRounded(recentPersonalRows, (row) => row.adr, 1),
        winRate: recentPersonalRows.length > 0 ? Math.round((wins / recentPersonalRows.length) * 100) : 0,
        avgHsPercent: Math.round(average(recentPersonalRows, (row) => row.hsPercent)),
        avgKrRatio: averageRounded(recentPersonalRows, (row) => row.krRatio, 2),
        avgFirstKills: averageRounded(recentPersonalRows, (row) => row.firstKills, 2),
        avgClutchKills: averageRounded(recentPersonalRows, (row) => row.clutchKills, 2),
        avgUtilityDamage: Math.round(average(recentPersonalRows, (row) => row.utilityDamage)),
        avgEnemiesFlashed: averageRounded(recentPersonalRows, (row) => row.enemiesFlashed, 1),
        avgEntryRate: recentPersonalRows.length > 0 && totalEntryCount > 0
          ? round(totalEntryWins / totalEntryCount, 2)
          : 0,
        avgSniperKills: averageRounded(recentPersonalRows, (row) => row.sniperKills, 2),
      } satisfies StatsLeaderboardEntry;
    })
    .filter((entry): entry is StatsLeaderboardEntry => entry !== null)
    .sort((a, b) => b.avgKd - a.avgKd || b.gamesPlayed - a.gamesPlayed || a.nickname.localeCompare(b.nickname));

  return {
    entries,
    targetMatchCount: targetMatchIds.size,
    sharedFriendCount: eligibleFriendIds.size,
  };
}

export const buildSharedStatsLeaderboard = buildPersonalFormLeaderboard;
