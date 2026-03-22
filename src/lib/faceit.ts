import type { FaceitPlayer, MatchPlayerStats } from "./types";

const BASE_URL = "https://open.faceit.com/data/v4";
const RETRYABLE_FACEIT_STATUSES = new Set([429, 500, 502, 503, 504]);
const FACEIT_RETRY_DELAYS_MS = [400, 900];

function getApiKey(): string {
  const key = process.env.FACEIT_SERVER_SIDE_API_KEY;
  if (!key) throw new Error("Missing FACEIT_SERVER_SIDE_API_KEY");
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function faceitFetch(path: string): Promise<unknown> {
  for (let attempt = 0; attempt <= FACEIT_RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        Accept: "application/json",
      },
    });

    if (res.ok) {
      return res.json();
    }

    const shouldRetry =
      RETRYABLE_FACEIT_STATUSES.has(res.status) &&
      attempt < FACEIT_RETRY_DELAYS_MS.length;

    if (shouldRetry) {
      await sleep(FACEIT_RETRY_DELAYS_MS[attempt]!);
      continue;
    }

    throw new Error(`FACEIT API error: ${res.status} ${res.statusText} for ${path}`);
  }

  throw new Error(`FACEIT API error: exhausted retries for ${path}`);
}

export function parsePlayerProfile(raw: any): FaceitPlayer {
  const cs2 = raw.games?.cs2;
  return {
    faceitId: raw.player_id,
    nickname: raw.nickname,
    avatar: raw.avatar || "",
    elo: cs2?.faceit_elo ?? 0,
    skillLevel: cs2?.skill_level ?? 0,
    country: raw.country || "",
  };
}

export function parseLifetimeStats(raw: any) {
  const lt = raw.lifetime || {};
  return {
    lifetimeKd: parseFloat(lt["Average K/D Ratio"]) || 0,
    lifetimeHs: parseInt(lt["Average Headshots %"]) || 0,
    lifetimeAdr: parseFloat(lt["ADR"]) || 0,
    winRate: parseInt(lt["Win Rate %"]) || 0,
    totalMatches: parseInt(lt["Matches"]) || 0,
    recentResults: (lt["Recent Results"] || []).map((r: string) => r === "1"),
  };
}

export function parseMatchStats(raw: any): MatchPlayerStats {
  const s = raw.player_stats || {};
  return {
    playerId: raw.player_id,
    nickname: raw.nickname,
    kills: parseInt(s["Kills"]) || 0,
    deaths: parseInt(s["Deaths"]) || 0,
    assists: parseInt(s["Assists"]) || 0,
    headshots: parseInt(s["Headshots"]) || 0,
    mvps: parseInt(s["MVPs"]) || 0,
    kdRatio: parseFloat(s["K/D Ratio"]) || 0,
    adr: parseFloat(s["ADR"]) || 0,
    hsPercent: parseInt(s["Headshots %"]) || 0,
    krRatio: parseFloat(s["K/R Ratio"]) || 0,
    tripleKills: parseInt(s["Triple Kills"]) || 0,
    quadroKills: parseInt(s["Quadro Kills"]) || 0,
    pentaKills: parseInt(s["Penta Kills"]) || 0,
    result: s["Result"] === "1",
    damage: parseInt(s["Damage"]) || 0,
    firstKills: parseInt(s["First Kills"]) || 0,
    entryCount: parseInt(s["Entry Count"]) || 0,
    entryWins: parseInt(s["Entry Wins"]) || 0,
    clutchKills: parseInt(s["Clutch Kills"]) || 0,
    oneV1Count: parseInt(s["1v1Count"]) || 0,
    oneV1Wins: parseInt(s["1v1Wins"]) || 0,
    oneV2Count: parseInt(s["1v2Count"]) || 0,
    oneV2Wins: parseInt(s["1v2Wins"]) || 0,
    doubleKills: parseInt(s["Double Kills"]) || 0,
    utilityDamage: parseInt(s["Utility Damage"]) || 0,
    enemiesFlashed: parseInt(s["Enemies Flashed"]) || 0,
    flashCount: parseInt(s["Flash Count"]) || 0,
    sniperKills: parseInt(s["Sniper Kills"]) || 0,
    pistolKills: parseInt(s["Pistol Kills"]) || 0,
  };
}

export function parseMatchTeamScore(raw: any): number {
  return (
    parseInt(raw?.["Final Score"]) ||
    parseInt(raw?.["Current Score"]) ||
    parseInt(raw?.Score) ||
    0
  );
}

export function buildMatchScoreString(roundStats: any, teams: any[]): string {
  if (roundStats?.Score) return roundStats.Score;

  const faction1 = parseMatchTeamScore(teams[0]?.team_stats);
  const faction2 = parseMatchTeamScore(teams[1]?.team_stats);

  if (faction1 > 0 || faction2 > 0) {
    return `${faction1} / ${faction2}`;
  }

  return "";
}

const ACTIVE_MATCH_STATUSES = new Set([
  "ONGOING",
  "READY",
  "VOTING",
  "CONFIGURING",
]);

export function pickRelevantHistoryMatch(history: any[]): any | null {
  if (!history.length) return null;

  const active = history.find((item) => ACTIVE_MATCH_STATUSES.has(item?.status));
  return active ?? history[0];
}

export async function fetchPlayer(
  playerId: string
): Promise<FaceitPlayer & { friendsIds: string[] }> {
  const data = await faceitFetch(`/players/${playerId}`) as any;
  return { ...parsePlayerProfile(data), friendsIds: data.friends_ids || [] };
}

export async function fetchPlayerByNickname(
  nickname: string
): Promise<FaceitPlayer & { friendsIds: string[] }> {
  const data = await faceitFetch(
    `/players?nickname=${encodeURIComponent(nickname)}&game=cs2`
  ) as any;
  return { ...parsePlayerProfile(data), friendsIds: data.friends_ids || [] };
}

export async function fetchPlayerLifetimeStats(playerId: string) {
  const data = await faceitFetch(`/players/${playerId}/stats/cs2`);
  return parseLifetimeStats(data);
}

export async function fetchPlayerHistory(playerId: string, limit = 30) {
  const data = (await faceitFetch(
    `/players/${playerId}/history?game=cs2&offset=0&limit=${limit}`
  )) as any;
  return data.items || [];
}

export async function fetchMatch(matchId: string) {
  return faceitFetch(`/matches/${matchId}`) as any;
}

export async function fetchMatchStats(matchId: string) {
  return faceitFetch(`/matches/${matchId}/stats`) as any;
}
