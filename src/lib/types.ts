export type MatchStatus = "ONGOING" | "FINISHED" | "CANCELLED";

export interface FaceitPlayer {
  faceitId: string;
  nickname: string;
  avatar: string;
  elo: number;
  skillLevel: number;
  country: string;
}

export interface FriendWithStats extends FaceitPlayer {
  lifetimeKd: number;
  lifetimeHs: number;
  lifetimeAdr: number;
  winRate: number;
  totalMatches: number;
  recentResults: boolean[]; // true = win, false = loss (last 5)
  twitchChannel: string | null;
  isPlaying: boolean;
  currentMatchId: string | null;
}

export interface LiveMatch {
  matchId: string;
  status: MatchStatus;
  map: string;
  score: { faction1: number; faction2: number };
  startedAt: number;
  teams: {
    faction1: MatchTeam;
    faction2: MatchTeam;
  };
  friendFaction: "faction1" | "faction2";
  friendIds: string[];
}

export interface MatchTeam {
  teamId: string;
  name: string;
  roster: MatchPlayer[];
}

export interface MatchPlayer {
  playerId: string;
  nickname: string;
  avatar: string;
  skillLevel: number;
}

export interface MatchPlayerStats {
  playerId: string;
  nickname: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  mvps: number;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  result: boolean; // win or loss
}

export interface MatchWithStats {
  matchId: string;
  map: string;
  score: string;
  status: MatchStatus;
  startedAt: number;
  finishedAt: number | null;
  players: MatchPlayerStats[];
}

export interface TwitchStream {
  channel: string;
  faceitId: string;
  isLive: boolean;
  viewerCount: number;
  title: string;
  thumbnailUrl: string;
}
