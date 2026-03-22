import { createServerFn } from "@tanstack/react-start";

const HISTORY_SYNC_BATCH_SIZE = 3;
const HISTORY_SYNC_PAGE_SIZE = 50;
const HISTORY_SYNC_MAX_PAGES = 6;
const LIVE_HISTORY_BATCH_SIZE = 1;
const BATCH_DELAY_MS = 300;
const LIVE_HISTORY_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 24 * 60 * 60 * 1000;
import {
  buildMatchScoreString,
  fetchPlayerHistory,
  fetchMatch,
  fetchMatchStats,
  pickRelevantHistoryMatch,
  parseMatchTeamScore,
  parseMatchStats,
} from "~/lib/faceit";
import {
  buildSharedStatsLeaderboard,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";
import { createServerSupabase } from "~/lib/supabase.server";
import type { LiveMatch, StatsLeaderboardResult } from "~/lib/types";
import { getWebhookLiveMatchMap } from "~/server/faceit-webhooks";

function getHistoryTimestamp(item: any): number | null {
  const raw = item?.finished_at ?? item?.started_at;
  if (raw == null) return null;
  const ts = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

export async function fetchPlayerHistoryWindow(
  faceitId: string,
  days: 7 | 30 | 90,
  pageSize = HISTORY_SYNC_PAGE_SIZE,
  maxPages = HISTORY_SYNC_MAX_PAGES
): Promise<any[]> {
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  const history: any[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const pageHistory = await fetchPlayerHistory(faceitId, pageSize, offset);
    if (pageHistory.length === 0) break;

    for (const item of pageHistory) {
      const ts = getHistoryTimestamp(item);
      if (ts != null && ts >= cutoff) {
        history.push(item);
      }
    }

    const oldest = getHistoryTimestamp(pageHistory[pageHistory.length - 1]);
    if (oldest == null || oldest < cutoff) break;
  }

  return history;
}

async function syncPlayerHistory(faceitId: string, n: number, days: 7 | 30 | 90): Promise<void> {
  const supabase = createServerSupabase();
  const pageSize = Math.max(HISTORY_SYNC_PAGE_SIZE, n);
  const history = await fetchPlayerHistoryWindow(faceitId, days, pageSize);

  for (let i = 0; i < history.length; i += HISTORY_SYNC_BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = history.slice(i, i + HISTORY_SYNC_BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (h: any) => {
        const statsData = await fetchMatchStats(h.match_id).catch(() => null);
        const round = statsData?.rounds?.[0];
        if (!round) return;

        const map = round.round_stats?.Map || "unknown";
        const score = round.round_stats?.Score || "";

        await supabase.from("matches").upsert(
          {
            faceit_match_id: h.match_id,
            status: "FINISHED",
            map,
            score,
            started_at: h.started_at
              ? new Date(h.started_at * 1000).toISOString()
              : null,
            finished_at: h.finished_at
              ? new Date(h.finished_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "faceit_match_id" }
        );

        const { data: matchRow } = await supabase
          .from("matches")
          .select("id")
          .eq("faceit_match_id", h.match_id)
          .single();

        if (!matchRow) return;

        for (const team of round.teams || []) {
          for (const player of team.players || []) {
            const p = parseMatchStats(player);
            await supabase.from("match_player_stats").upsert(
              {
                match_id: matchRow.id,
                faceit_player_id: p.playerId,
                nickname: p.nickname,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                headshots: p.headshots,
                mvps: p.mvps,
                kd_ratio: p.kdRatio,
                adr: p.adr,
                hs_percent: p.hsPercent,
                kr_ratio: p.krRatio,
                triple_kills: p.tripleKills,
                quadro_kills: p.quadroKills,
                penta_kills: p.pentaKills,
                win: p.result,
                damage: p.damage,
                first_kills: p.firstKills,
                entry_count: p.entryCount,
                entry_wins: p.entryWins,
                clutch_kills: p.clutchKills,
                one_v1_count: p.oneV1Count,
                one_v1_wins: p.oneV1Wins,
                one_v2_count: p.oneV2Count,
                one_v2_wins: p.oneV2Wins,
                double_kills: p.doubleKills,
                utility_damage: p.utilityDamage,
                enemies_flashed: p.enemiesFlashed,
                flash_count: p.flashCount,
                sniper_kills: p.sniperKills,
                pistol_kills: p.pistolKills,
                map,
                played_at: h.finished_at
                  ? new Date(h.finished_at * 1000).toISOString()
                  : null,
              },
              { onConflict: "match_id,faceit_player_id" }
            );
          }
        }
      })
    );
  }
}

export const getLiveMatches = createServerFn({ method: "GET" })
  .inputValidator((playerIds: string[]) => playerIds)
  .handler(async ({ data: playerIds }): Promise<LiveMatch[]> => {
    const ids = playerIds;
    const supabase = createServerSupabase();
    const liveMatches: LiveMatch[] = [];
    const uniqueMatches = await getWebhookLiveMatchMap(ids);
    const playerIdsCoveredByWebhook = new Set(
      [...uniqueMatches.values()].flatMap((friendIds) => friendIds)
    );
    const fallbackIds = ids.filter((id) => !playerIdsCoveredByWebhook.has(id));

    // Batch history calls to stay within FACEIT rate limits
    const historyResults: PromiseSettledResult<{ matchId: string; friendId: string } | null>[] = [];
    for (let i = 0; i < fallbackIds.length; i += LIVE_HISTORY_BATCH_SIZE) {
      if (i > 0) await sleep(LIVE_HISTORY_DELAY_MS);
      const batch = fallbackIds.slice(i, i + LIVE_HISTORY_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (friendId) => {
          const history = await fetchPlayerHistory(friendId, 5, 0);
          const candidate = pickRelevantHistoryMatch(history);
          if (!candidate) return null;
          return { matchId: candidate.match_id, friendId };
        })
      );
      historyResults.push(...batchResults);
    }

    for (const result of historyResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { matchId, friendId } = result.value;
      if (!uniqueMatches.has(matchId)) uniqueMatches.set(matchId, []);
      uniqueMatches.get(matchId)!.push(friendId);
    }

    const THIRTY_MINUTES = 30 * 60;
    const matchResults = await Promise.allSettled(
      [...uniqueMatches.entries()].map(async ([matchId]) => {
        const match = await fetchMatch(matchId);
        const activeStatuses = ["ONGOING", "READY", "VOTING", "CONFIGURING"];
        if (activeStatuses.includes(match.status)) {
          return { match, friendIds: uniqueMatches.get(matchId)! };
        }
        if (match.status === "FINISHED" && match.finished_at) {
          const age = Math.floor(Date.now() / 1000) - match.finished_at;
          if (age <= THIRTY_MINUTES) {
            return { match, friendIds: uniqueMatches.get(matchId)! };
          }
        }
        return null;
      })
    );

    for (const result of matchResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { match, friendIds } = result.value;

      let friendFaction: "faction1" | "faction2" = "faction1";
      const foundFriendIds: string[] = [];
      for (const faction of ["faction1", "faction2"] as const) {
        const roster = match.teams?.[faction]?.roster || [];
        const found = roster.filter((p: any) => ids.includes(p.player_id));
        if (found.length > 0) {
          friendFaction = faction;
          foundFriendIds.push(...found.map((p: any) => p.player_id));
        }
      }

      const liveMatch: LiveMatch = {
        matchId: match.match_id,
        status: match.status,
        map: match.voting?.map?.pick?.[0] || "unknown",
        score: match.results?.score || { faction1: 0, faction2: 0 },
        startedAt: match.started_at || 0,
        teams: {
          faction1: {
            teamId: match.teams.faction1.faction_id,
            name: match.teams.faction1.leader || "Team 1",
            roster: (match.teams.faction1.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
          faction2: {
            teamId: match.teams.faction2.faction_id,
            name: match.teams.faction2.leader || "Team 2",
            roster: (match.teams.faction2.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
        },
        friendFaction,
        friendIds: foundFriendIds.length > 0 ? foundFriendIds : friendIds,
      };
      liveMatches.push(liveMatch);

      await supabase.from("matches").upsert(
        {
          faceit_match_id: match.match_id,
          status: match.status,
          map: liveMatch.map,
          started_at: match.started_at
            ? new Date(match.started_at * 1000).toISOString()
            : null,
          match_data: match,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );
    }

    liveMatches.sort((a, b) => {
      const aActive = a.status === "ONGOING" || a.status === "READY" || a.status === "VOTING" || a.status === "CONFIGURING";
      const bActive = b.status === "ONGOING" || b.status === "READY" || b.status === "VOTING" || b.status === "CONFIGURING";

      if (aActive !== bActive) return aActive ? -1 : 1;
      return (b.startedAt || 0) - (a.startedAt || 0);
    });

    // ── Betting pool lifecycle ─────────────────────────────────

    // 1. Create betting pools for new ONGOING matches within the 5-min window
    for (const liveMatch of liveMatches) {
      if (liveMatch.startedAt === 0) continue;
      const matchAgeSeconds = Math.floor(Date.now() / 1000) - liveMatch.startedAt;
      if (matchAgeSeconds <= 5 * 60) {
        await supabase.from("betting_pools").insert({
          faceit_match_id: liveMatch.matchId,
          team1_name: liveMatch.teams.faction1.name,
          team2_name: liveMatch.teams.faction2.name,
          opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
          closes_at: new Date(liveMatch.startedAt * 1000 + 5 * 60 * 1000).toISOString(),
        }).onConflict("faceit_match_id").ignore();
      }
    }

    // 2. Stale pool sweep: resolve/cancel pools whose match left the live list
    const liveIds = liveMatches
      .filter((m) => m.status !== "FINISHED")
      .map((m) => m.matchId);
    const { data: stalePools } = await supabase
      .from("betting_pools")
      .select("faceit_match_id")
      .in("status", ["OPEN", "CLOSED"]);

    for (const pool of stalePools ?? []) {
      if (liveIds.includes(pool.faceit_match_id)) continue;
      try {
        const match = await fetchMatch(pool.faceit_match_id);
        if (match.status === "FINISHED") {
          const score = match.results?.score;
          if (score) {
            const winner = score.faction1 > score.faction2 ? "team1" : "team2";
            await supabase.rpc("resolve_pool", {
              p_faceit_match_id: pool.faceit_match_id,
              p_winning_team: winner,
            });
          }
        } else if (match.status === "CANCELLED") {
          await supabase.rpc("cancel_pool", {
            p_faceit_match_id: pool.faceit_match_id,
          });
        }
      } catch {
        // Ignore per-match errors, continue sweep
      }
    }

    return liveMatches;
  }
);

export const getMatchDetails = createServerFn({ method: "GET" })
  .inputValidator((matchId: string) => matchId)
  .handler(async ({ data: matchId }) => {
    const [match, statsData] = await Promise.all([
      fetchMatch(matchId),
      fetchMatchStats(matchId).catch(() => null),
    ]);

    const players: any[] = [];
    const teamPlayers: { faction1: string[]; faction2: string[] } = { faction1: [], faction2: [] };
    if (statsData?.rounds?.[0]?.teams) {
      const teams = statsData.rounds[0].teams;
      for (let ti = 0; ti < teams.length; ti++) {
        const faction = ti === 0 ? "faction1" : "faction2";
        for (const player of teams[ti].players || []) {
          const parsed = parseMatchStats(player);
          players.push(parsed);
          teamPlayers[faction].push(parsed.playerId);
        }
      }
    }

    const roundStats = statsData?.rounds?.[0]?.round_stats || {};
    const teamStats = statsData?.rounds?.[0]?.teams || [];
    const faction1Name = teamStats[0]?.team_stats?.Team || match.teams?.faction1?.name || "Team 1";
    const faction2Name = teamStats[1]?.team_stats?.Team || match.teams?.faction2?.name || "Team 2";
    const faction1Score = parseMatchTeamScore(teamStats[0]?.team_stats);
    const faction2Score = parseMatchTeamScore(teamStats[1]?.team_stats);

    const result = {
      matchId: match.match_id,
      map:
        match.voting?.map?.pick?.[0] ||
        roundStats.Map ||
        "unknown",
      score: buildMatchScoreString(roundStats, teamStats),
      status: match.status,
      startedAt: match.started_at || 0,
      finishedAt: match.finished_at || null,
      players,
      demoUrl: (match.demo_url as string[] | undefined)?.[0] ?? null,
      teams: {
        faction1: { name: faction1Name, score: faction1Score, playerIds: teamPlayers.faction1 },
        faction2: { name: faction2Name, score: faction2Score, playerIds: teamPlayers.faction2 },
      },
      rounds: parseInt(roundStats.Rounds) || 0,
      region: roundStats.Region || match.region || "",
      competitionName: match.competition_name || "",
    };

    if (match.status === "FINISHED") {
      const supabase = createServerSupabase();
      await supabase.from("matches").upsert(
        {
          faceit_match_id: matchId,
          status: "FINISHED",
          map: result.map,
          score: result.score,
          finished_at: match.finished_at
            ? new Date(match.finished_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );

      const { data: matchRow } = await supabase
        .from("matches")
        .select("id")
        .eq("faceit_match_id", matchId)
        .single();

      if (matchRow) {
        for (const p of players) {
          await supabase.from("match_player_stats").upsert(
            {
              match_id: matchRow.id,
              faceit_player_id: p.playerId,
              nickname: p.nickname,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              headshots: p.headshots,
              mvps: p.mvps,
              kd_ratio: p.kdRatio,
              adr: p.adr,
              hs_percent: p.hsPercent,
              kr_ratio: p.krRatio,
              triple_kills: p.tripleKills,
              quadro_kills: p.quadroKills,
              penta_kills: p.pentaKills,
              win: p.result,
              damage: p.damage,
              first_kills: p.firstKills,
              entry_count: p.entryCount,
              entry_wins: p.entryWins,
              clutch_kills: p.clutchKills,
              one_v1_count: p.oneV1Count,
              one_v1_wins: p.oneV1Wins,
              one_v2_count: p.oneV2Count,
              one_v2_wins: p.oneV2Wins,
              double_kills: p.doubleKills,
              utility_damage: p.utilityDamage,
              enemies_flashed: p.enemiesFlashed,
              flash_count: p.flashCount,
              sniper_kills: p.sniperKills,
              pistol_kills: p.pistolKills,
              map: result.map,
              played_at: match.finished_at
                ? new Date(match.finished_at * 1000).toISOString()
                : null,
            },
            { onConflict: "match_id,faceit_player_id" }
          );
        }
      }
    }

    return result;
  });

export const getStatsLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((input: { targetPlayerId: string; playerIds: string[]; n: 20 | 50 | 100; days: 7 | 30 | 90 }) => input)
  .handler(async ({ data: { targetPlayerId, playerIds, n, days } }): Promise<StatsLeaderboardResult> => {
    const supabase = createServerSupabase();
    const uniquePlayerIds = [...new Set([targetPlayerId, ...playerIds])];
    const cutoffIso = new Date(Date.now() - days * DAY_MS).toISOString();

    const { data: friendRows } = playerIds.length === 0
      ? { data: [] }
      : await supabase
          .from("tracked_friends")
          .select("faceit_id, nickname, elo")
          .in("faceit_id", playerIds);

    const friendMap = new Map(
      (friendRows || []).map((f: any) => [f.faceit_id, { nickname: f.nickname, elo: f.elo ?? 0 }])
    );

    const { data: rows } = await supabase
      .from("match_player_stats")
      .select("match_id, faceit_player_id, nickname, played_at, kd_ratio, adr, hs_percent, kr_ratio, win, first_kills, clutch_kills, utility_damage, enemies_flashed, entry_count, entry_wins, sniper_kills")
      .in("faceit_player_id", uniquePlayerIds)
      .gte("played_at", cutoffIso)
      .order("played_at", { ascending: false });

    const normalizedRows: SharedStatsLeaderboardRow[] = (rows || []).map((row: any) => {
      const meta = friendMap.get(row.faceit_player_id);

      return {
        matchId: row.match_id,
        playedAt: row.played_at,
        faceitId: row.faceit_player_id,
        nickname: row.nickname || meta?.nickname || row.faceit_player_id,
        elo: meta?.elo ?? 0,
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
      };
    });

    let result = buildSharedStatsLeaderboard({
      rows: normalizedRows,
      targetPlayerId,
      friendIds: playerIds,
      n,
      days,
    });

    const targetEntry = result.entries.find((entry) => entry.faceitId === targetPlayerId);
    if (targetEntry) {
      try {
        const { fetchPlayer } = await import("~/lib/faceit");
        const target = await fetchPlayer(targetPlayerId);
        result = {
          ...result,
          entries: result.entries.map((entry) =>
            entry.faceitId === targetPlayerId ? { ...entry, elo: target.elo } : entry
          ),
        };
      } catch {
        // Preserve the leaderboard if the live ELO lookup fails.
      }
    }

    return result;
  });

export const syncAllPlayerHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { targetPlayerId: string; playerIds: string[]; n: number; days: 7 | 30 | 90 }) => input)
  .handler(async ({ data: { targetPlayerId, playerIds, n, days } }): Promise<void> => {
    for (const faceitId of [...new Set([targetPlayerId, ...playerIds])]) {
      await syncPlayerHistory(faceitId, n, days);
    }
  });

export const getPlayerStats = createServerFn({ method: "GET" })
  .inputValidator((playerId: string) => playerId)
  .handler(async ({ data: playerId }) => {
    const history = await fetchPlayerHistory(playerId, 15, 0); // capped at 15 to limit API calls

    const allResults: PromiseSettledResult<any>[] = [];
    for (let i = 0; i < history.length; i += 5) {
      if (i > 0) await sleep(BATCH_DELAY_MS);
      const batch = history.slice(i, i + 5);
      const batchResults = await Promise.allSettled(
        batch.map(async (h: any) => {
          const stats = await fetchMatchStats(h.match_id);
          const round = stats.rounds?.[0];
          if (!round) return null;

          for (const team of round.teams || []) {
            const player = (team.players || []).find(
              (p: any) => p.player_id === playerId
            );
            if (player) {
              return {
                matchId: h.match_id,
                map: round.round_stats?.Map || "unknown",
                score: round.round_stats?.Score || "",
                startedAt: h.started_at,
                finishedAt: h.finished_at,
                ...parseMatchStats(player),
              };
            }
          }
          return null;
        })
      );
      allResults.push(...batchResults);
    }
    const matches = allResults;

    return matches
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r: any) => r.value);
  });
