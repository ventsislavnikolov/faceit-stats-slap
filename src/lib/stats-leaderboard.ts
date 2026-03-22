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

export function buildSharedStatsLeaderboard({
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

  const perFriendRows = new Map<string, ValidSharedStatsLeaderboardRow[]>();
  for (const matchId of targetMatchIds) {
    const matchRows = rowsByMatch.get(matchId) ?? [];
    for (const row of matchRows) {
      if (!friendSet.has(row.faceitId)) continue;
      if (!perFriendRows.has(row.faceitId)) perFriendRows.set(row.faceitId, []);
      perFriendRows.get(row.faceitId)!.push(row);
    }
  }

  const entries = [...perFriendRows.entries()]
    .map(([faceitId, sharedRows]) => {
      const recentSharedRows = [...sharedRows]
        .sort((a, b) => b.playedAtMs - a.playedAtMs)
        .slice(0, n);

      if (recentSharedRows.length === 0) return null;

      const latest = recentSharedRows[0];
      const wins = recentSharedRows.filter((row) => row.win).length;
      const totalEntryCount = recentSharedRows.reduce((sum, row) => sum + (Number(row.entryCount) || 0), 0);
      const totalEntryWins = recentSharedRows.reduce((sum, row) => sum + (Number(row.entryWins) || 0), 0);

      return {
        faceitId,
        nickname: latest.nickname || faceitId,
        elo: Number(latest.elo) || 0,
        gamesPlayed: recentSharedRows.length,
        avgKd: averageRounded(recentSharedRows, (row) => row.kdRatio, 2),
        avgAdr: averageRounded(recentSharedRows, (row) => row.adr, 1),
        winRate: recentSharedRows.length > 0 ? Math.round((wins / recentSharedRows.length) * 100) : 0,
        avgHsPercent: Math.round(average(recentSharedRows, (row) => row.hsPercent)),
        avgKrRatio: averageRounded(recentSharedRows, (row) => row.krRatio, 2),
        avgFirstKills: averageRounded(recentSharedRows, (row) => row.firstKills, 2),
        avgClutchKills: averageRounded(recentSharedRows, (row) => row.clutchKills, 2),
        avgUtilityDamage: Math.round(average(recentSharedRows, (row) => row.utilityDamage)),
        avgEnemiesFlashed: averageRounded(recentSharedRows, (row) => row.enemiesFlashed, 1),
        avgEntryRate: recentSharedRows.length > 0 && totalEntryCount > 0
          ? round(totalEntryWins / totalEntryCount, 2)
          : 0,
        avgSniperKills: averageRounded(recentSharedRows, (row) => row.sniperKills, 2),
      } satisfies StatsLeaderboardEntry;
    })
    .filter((entry): entry is StatsLeaderboardEntry => entry !== null)
    .sort((a, b) => b.avgKd - a.avgKd || b.gamesPlayed - a.gamesPlayed || a.nickname.localeCompare(b.nickname));

  return {
    entries,
    targetMatchCount: targetMatchIds.size,
    sharedFriendCount: entries.length,
  };
}
