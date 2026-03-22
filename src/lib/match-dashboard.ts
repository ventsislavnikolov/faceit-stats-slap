import { getTwitchChannel } from "~/lib/constants";
import type { FriendWithStats, MatchStatus } from "~/lib/types";

type DashboardRosterPlayer = {
  playerId: string;
  nickname: string;
  avatar: string;
  skillLevel: number;
  elo: number;
  lifetimeKd: number;
  lifetimeHs: number;
  lifetimeAdr: number;
  winRate: number;
  recentResults: boolean[];
};

const ACTIVE_MATCH_STATUSES = new Set<MatchStatus>([
  "ONGOING",
  "READY",
  "VOTING",
  "CONFIGURING",
]);

export function buildMatchDashboardFriends(
  players: DashboardRosterPlayer[],
  matchId: string,
  status: MatchStatus
): FriendWithStats[] {
  const isPlaying = ACTIVE_MATCH_STATUSES.has(status);

  return players.map((player) => ({
    faceitId: player.playerId,
    nickname: player.nickname,
    avatar: player.avatar,
    elo: player.elo,
    skillLevel: player.skillLevel,
    country: "",
    lifetimeKd: player.lifetimeKd,
    lifetimeHs: player.lifetimeHs,
    lifetimeAdr: player.lifetimeAdr,
    winRate: player.winRate,
    totalMatches: 0,
    recentResults: player.recentResults,
    twitchChannel: getTwitchChannel(player.playerId),
    isPlaying,
    currentMatchId: isPlaying ? matchId : null,
  }));
}
