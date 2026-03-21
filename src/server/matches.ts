import { createServerFn } from "@tanstack/react-start";
import { TRACKED_FRIENDS } from "~/lib/constants";

const BATCH_DELAY_MS = 150;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
import {
  fetchPlayerHistory,
  fetchMatch,
  fetchMatchStats,
  parseMatchStats,
} from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";
import type { LiveMatch } from "~/lib/types";

export const getLiveMatches = createServerFn({ method: "GET" })
  .inputValidator((playerIds?: string[]) => playerIds)
  .handler(async ({ data: playerIds }): Promise<LiveMatch[]> => {
    const ids = playerIds && playerIds.length > 0
      ? playerIds
      : (TRACKED_FRIENDS as readonly string[]);
    const supabase = createServerSupabase();
    const liveMatches: LiveMatch[] = [];

    // Batch history calls to stay within FACEIT rate limits
    const historyResults: PromiseSettledResult<{ matchId: string; friendId: string } | null>[] = [];
    for (let i = 0; i < ids.length; i += 5) {
      if (i > 0) await sleep(BATCH_DELAY_MS);
      const batch = ids.slice(i, i + 5);
      const batchResults = await Promise.allSettled(
        batch.map(async (friendId) => {
          const history = await fetchPlayerHistory(friendId, 1);
          if (!history.length) return null;
          return { matchId: history[0].match_id, friendId };
        })
      );
      historyResults.push(...batchResults);
    }

    const uniqueMatches = new Map<string, string[]>();
    for (const result of historyResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { matchId, friendId } = result.value;
      if (!uniqueMatches.has(matchId)) uniqueMatches.set(matchId, []);
      uniqueMatches.get(matchId)!.push(friendId);
    }

    const matchResults = await Promise.allSettled(
      [...uniqueMatches.entries()].map(async ([matchId]) => {
        const match = await fetchMatch(matchId);
        const activeStatuses = ["ONGOING", "READY", "VOTING", "CONFIGURING"];
        if (!activeStatuses.includes(match.status)) return null;
        return { match, friendIds: uniqueMatches.get(matchId)! };
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
    if (statsData?.rounds?.[0]?.teams) {
      for (const team of statsData.rounds[0].teams) {
        for (const player of team.players || []) {
          players.push(parseMatchStats(player));
        }
      }
    }

    const result = {
      matchId: match.match_id,
      map:
        match.voting?.map?.pick?.[0] ||
        statsData?.rounds?.[0]?.round_stats?.Map ||
        "unknown",
      score: statsData?.rounds?.[0]?.round_stats?.Score || "",
      status: match.status,
      startedAt: match.started_at || 0,
      finishedAt: match.finished_at || null,
      players,
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
              triple_kills: p.tripleKills,
              quadro_kills: p.quadroKills,
              penta_kills: p.pentaKills,
              win: p.result,
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

export const getPlayerStats = createServerFn({ method: "GET" })
  .inputValidator((playerId: string) => playerId)
  .handler(async ({ data: playerId }) => {
    const history = await fetchPlayerHistory(playerId, 15); // capped at 15 to limit API calls

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
