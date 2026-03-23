import type { StatsLeaderboardEntry } from "~/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SharedStatsLeaderboardRow {
  matchId: string;
  playedAt: string | number | Date | null | undefined;
  faceitId: string;
  nickname: string;
  elo: number;
  kills: number;
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

interface ImpactBaseline {
  kd: number;
  adr: number;
  kr: number;
  entryRate: number;
}

const IMPACT_BASELINE_POINTS: Array<{ elo: number } & ImpactBaseline> = [
  { elo: 500, kd: 0.95, adr: 68, kr: 0.62, entryRate: 0.44 },
  { elo: 900, kd: 1.0, adr: 72, kr: 0.66, entryRate: 0.46 },
  { elo: 1225, kd: 1.05, adr: 76, kr: 0.69, entryRate: 0.48 },
  { elo: 1575, kd: 1.1, adr: 80, kr: 0.72, entryRate: 0.5 },
  { elo: 2000, kd: 1.15, adr: 84, kr: 0.75, entryRate: 0.52 },
  { elo: 2400, kd: 1.18, adr: 87, kr: 0.77, entryRate: 0.53 },
  { elo: 2800, kd: 1.22, adr: 90, kr: 0.79, entryRate: 0.54 },
  { elo: 3200, kd: 1.26, adr: 94, kr: 0.82, entryRate: 0.55 },
  { elo: 3600, kd: 1.3, adr: 98, kr: 0.85, entryRate: 0.56 },
];

export interface StatsLeaderboardResult {
  entries: StatsLeaderboardEntry[];
  targetMatchCount: number;
  sharedFriendCount: number;
}

export interface BuildSharedStatsLeaderboardInput {
  rows: SharedStatsLeaderboardRow[];
  targetPlayerId: string;
  friendIds: string[];
  eligibleFriendIds?: string[];
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

function averageNumbers(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function getImpactBaseline(elo: number): ImpactBaseline {
  const numericElo = Number.isFinite(elo) ? elo : 0;
  const first = IMPACT_BASELINE_POINTS[0];
  const last = IMPACT_BASELINE_POINTS[IMPACT_BASELINE_POINTS.length - 1];

  if (numericElo <= first.elo) {
    return { kd: first.kd, adr: first.adr, kr: first.kr, entryRate: first.entryRate };
  }

  if (numericElo >= last.elo) {
    return { kd: last.kd, adr: last.adr, kr: last.kr, entryRate: last.entryRate };
  }

  for (let index = 1; index < IMPACT_BASELINE_POINTS.length; index += 1) {
    const previous = IMPACT_BASELINE_POINTS[index - 1];
    const current = IMPACT_BASELINE_POINTS[index];
    if (numericElo > current.elo) continue;

    const t = (numericElo - previous.elo) / (current.elo - previous.elo);
    return {
      kd: interpolate(previous.kd, current.kd, t),
      adr: interpolate(previous.adr, current.adr, t),
      kr: interpolate(previous.kr, current.kr, t),
      entryRate: interpolate(previous.entryRate, current.entryRate, t),
    };
  }

  return { kd: last.kd, adr: last.adr, kr: last.kr, entryRate: last.entryRate };
}

function getEntryRate(row: SharedStatsLeaderboardRow): number {
  const entryCount = Number(row.entryCount) || 0;
  const entryWins = Number(row.entryWins) || 0;
  if (entryCount <= 0) return 0;
  return clamp(entryWins / entryCount, 0, 1);
}

function computeImpactScore(row: SharedStatsLeaderboardRow): number {
  const baseline = getImpactBaseline(Number(row.elo) || 0);
  const cappedKd = Math.min(Math.max(Number(row.kdRatio) || 0, 0), 2.5);
  const cappedAdr = Math.min(Math.max(Number(row.adr) || 0, 0), 140);
  const cappedKr = Math.min(Math.max(Number(row.krRatio) || 0, 0), 1.2);
  const cappedEntryRate = Math.min(getEntryRate(row), 0.75);

  const overperf =
    0.45 * (cappedKd - baseline.kd) +
    0.25 * ((cappedAdr - baseline.adr) / 10) +
    0.2 * (cappedKr - baseline.kr) +
    0.1 * (cappedEntryRate - baseline.entryRate);
  const difficulty = clamp(Math.sqrt(Math.max(Number(row.elo) || 0, 1) / 2000), 0.85, 1.2);

  return 100 + 60 * overperf * difficulty + (row.win ? 5 : 0);
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
  eligibleFriendIds: precomputedEligibleFriendIds,
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

  const eligibleFriendIds = precomputedEligibleFriendIds?.length
    ? new Set(
        precomputedEligibleFriendIds.filter(
          (faceitId) => faceitId !== targetPlayerId && friendSet.has(faceitId)
        )
      )
    : new Set<string>();

  if (!precomputedEligibleFriendIds?.length) {
    for (const matchId of targetMatchIds) {
      const matchRows = rowsByMatch.get(matchId) ?? [];
      for (const row of matchRows) {
        if (friendSet.has(row.faceitId)) {
          eligibleFriendIds.add(row.faceitId);
        }
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
      const impactScores = recentPersonalRows.map((row) => computeImpactScore(row));

      return {
        faceitId,
        nickname: latest.nickname || faceitId,
        elo: Number(latest.elo) || 0,
        gamesPlayed: recentPersonalRows.length,
        avgImpact: round(averageNumbers(impactScores), 1),
        avgKills: averageRounded(recentPersonalRows, (row) => row.kills, 2),
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
    .sort((a, b) => b.avgImpact - a.avgImpact || b.gamesPlayed - a.gamesPlayed || a.nickname.localeCompare(b.nickname));

  return {
    entries,
    targetMatchCount: targetMatchIds.size,
    sharedFriendCount: eligibleFriendIds.size,
  };
}

export const buildSharedStatsLeaderboard = buildPersonalFormLeaderboard;
