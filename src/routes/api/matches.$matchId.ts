import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchMatch, fetchMatchStats, parseMatchStats } from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";

export const APIRoute = createAPIFileRoute("/api/matches/$matchId")({
  GET: async ({ params }) => {
    const { matchId } = params;
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

    return Response.json(result);
  },
});
