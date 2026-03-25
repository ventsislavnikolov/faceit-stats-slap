import type {
  LiveMatch,
  MatchDetail,
  MatchPlayerStats,
  MatchTeam,
} from "./types";

function getFriendNicknames(team: MatchTeam, friendIds: string[]): string[] {
  return team.roster
    .filter((player) => friendIds.includes(player.playerId))
    .map((player) => player.nickname);
}

function formatTeamLabel(friendNicknames: string[]): string {
  if (friendNicknames.length === 0) {
    return "Opponents";
  }
  return friendNicknames[0];
}

export function getLiveMatchTeamLabels(match: LiveMatch): {
  faction1: string;
  faction2: string;
} {
  return {
    faction1: formatTeamLabel(
      getFriendNicknames(match.teams.faction1, match.friendIds)
    ),
    faction2: formatTeamLabel(
      getFriendNicknames(match.teams.faction2, match.friendIds)
    ),
  };
}

export function getLiveMatchDisplayScore(
  match: LiveMatch,
  details?: MatchDetail | null
): { faction1: number; faction2: number } {
  if (details) {
    const faction1 = details.teams.faction1.score;
    const faction2 = details.teams.faction2.score;
    if (faction1 > 0 || faction2 > 0) {
      return { faction1, faction2 };
    }
  }

  return match.score;
}

export function getFriendScoreboardPlayers(
  players: MatchPlayerStats[],
  friendIds: string[]
): MatchPlayerStats[] {
  const friendSet = new Set(friendIds);

  return players
    .filter((player) => friendSet.has(player.playerId))
    .sort((a, b) => b.kills - a.kills);
}
