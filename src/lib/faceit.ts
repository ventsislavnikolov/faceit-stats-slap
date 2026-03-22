import type { FaceitPlayer, MatchPlayerStats } from "./types";

const BASE_URL = "https://open.faceit.com/data/v4";

function getApiKey(): string {
  const key = process.env.FACEIT_SERVER_SIDE_API_KEY;
  if (!key) throw new Error("Missing FACEIT_SERVER_SIDE_API_KEY");
  return key;
}

async function faceitFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`FACEIT API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
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
  };
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
