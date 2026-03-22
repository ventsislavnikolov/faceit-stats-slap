import type { LiveMatch, MatchTeam } from "./types";

function getFriendNicknames(team: MatchTeam, friendIds: string[]): string[] {
  return team.roster
    .filter((player) => friendIds.includes(player.playerId))
    .map((player) => player.nickname);
}

function formatTeamLabel(friendNicknames: string[]): string {
  if (friendNicknames.length === 0) return "Opponents";
  if (friendNicknames.length === 1) return friendNicknames[0];
  return `${friendNicknames[0]} +${friendNicknames.length - 1}`;
}

export function getLiveMatchTeamLabels(match: LiveMatch): {
  faction1: string;
  faction2: string;
} {
  return {
    faction1: formatTeamLabel(getFriendNicknames(match.teams.faction1, match.friendIds)),
    faction2: formatTeamLabel(getFriendNicknames(match.teams.faction2, match.friendIds)),
  };
}
