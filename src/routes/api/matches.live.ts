import { createAPIFileRoute } from "@tanstack/react-start/api";
import { TRACKED_FRIENDS } from "~/lib/constants";
import { fetchPlayerHistory, fetchMatch } from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";
import type { LiveMatch } from "~/lib/types";

export const APIRoute = createAPIFileRoute("/api/matches/live")({
  GET: async () => {
    const supabase = createServerSupabase();
    const liveMatches: LiveMatch[] = [];

    // Step 1: Fetch latest match ID for each friend (parallel)
    const historyResults = await Promise.allSettled(
      TRACKED_FRIENDS.map(async (friendId) => {
        const history = await fetchPlayerHistory(friendId, 1);
        if (!history.length) return null;
        return { matchId: history[0].match_id, friendId };
      })
    );

    // Step 2: Deduplicate match IDs
    const uniqueMatches = new Map<string, string[]>();
    for (const result of historyResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { matchId, friendId } = result.value;
      if (!uniqueMatches.has(matchId)) uniqueMatches.set(matchId, []);
      uniqueMatches.get(matchId)!.push(friendId);
    }

    // Step 3: Fetch match details and filter for ONGOING
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

      // Find which faction has our friends
      let friendFaction: "faction1" | "faction2" = "faction1";
      const foundFriendIds: string[] = [];
      for (const faction of ["faction1", "faction2"] as const) {
        const roster = match.teams?.[faction]?.roster || [];
        const found = roster.filter((p: any) =>
          (TRACKED_FRIENDS as readonly string[]).includes(p.player_id)
        );
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

    return Response.json(liveMatches);
  },
});
