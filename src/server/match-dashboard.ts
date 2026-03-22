import { getTwitchChannel, MY_FACEIT_ID } from "~/lib/constants";
import { fetchMatch } from "~/lib/faceit";
import { buildMatchDashboardFriends } from "~/lib/match-dashboard";
import type { FriendWithStats, LiveMatch } from "~/lib/types";

export async function buildMatchDashboardData(
  matchId: string
): Promise<{ match: LiveMatch; players: FriendWithStats[] }> {
  const match = await fetchMatch(matchId);
  const faction1Roster = match.teams?.faction1?.roster || [];
  const faction2Roster = match.teams?.faction2?.roster || [];

  const getFocusScore = (roster: any[]) =>
    roster.reduce((score: number, player: any) => {
      if (player.player_id === MY_FACEIT_ID) return score + 100;
      if (getTwitchChannel(player.player_id)) return score + 10;
      return score;
    }, 0);

  const focusFaction = getFocusScore(faction2Roster) > getFocusScore(faction1Roster)
    ? "faction2"
    : "faction1";

  const liveMatch: LiveMatch = {
    matchId: match.match_id,
    status: match.status,
    map: match.voting?.map?.pick?.[0] || "unknown",
    score: match.results?.score || { faction1: 0, faction2: 0 },
    startedAt: match.started_at || 0,
    teams: {
      faction1: {
        teamId: match.teams.faction1.faction_id,
        name: match.teams.faction1.name || "Team 1",
        roster: faction1Roster.map((p: any) => ({
          playerId: p.player_id,
          nickname: p.nickname,
          avatar: p.avatar || "",
          skillLevel: p.game_skill_level || 0,
        })),
      },
      faction2: {
        teamId: match.teams.faction2.faction_id,
        name: match.teams.faction2.name || "Team 2",
        roster: faction2Roster.map((p: any) => ({
          playerId: p.player_id,
          nickname: p.nickname,
          avatar: p.avatar || "",
          skillLevel: p.game_skill_level || 0,
        })),
      },
    },
    friendFaction: focusFaction,
    friendIds: (match.teams?.[focusFaction]?.roster || []).map((p: any) => p.player_id),
  };

  const players: FriendWithStats[] = buildMatchDashboardFriends(
    [...faction1Roster, ...faction2Roster].map((player: any) => ({
      playerId: player.player_id,
      nickname: player.nickname,
      avatar: player.avatar || "",
      skillLevel: player.game_skill_level || 0,
      elo: player.faceit_elo || 0,
      lifetimeKd: 0,
      lifetimeHs: 0,
      lifetimeAdr: 0,
      winRate: 0,
      recentResults: [],
    })),
    liveMatch.matchId,
    liveMatch.status
  );

  return { match: liveMatch, players };
}
