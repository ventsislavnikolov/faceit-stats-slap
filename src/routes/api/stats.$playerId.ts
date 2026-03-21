import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchPlayerHistory, fetchMatchStats, parseMatchStats } from "~/lib/faceit";

export const APIRoute = createAPIFileRoute("/api/stats/$playerId")({
  GET: async ({ params }) => {
    const { playerId } = params;
    const history = await fetchPlayerHistory(playerId, 30);

    const matches = await Promise.allSettled(
      history.map(async (h: any) => {
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

    const results = matches
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r: any) => r.value);

    return Response.json(results);
  },
});
