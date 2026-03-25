export type MatchStatus = "ONGOING" | "READY" | "VOTING" | "CONFIGURING" | "FINISHED" | "CANCELLED";
export type MatchQueueBucket = "solo" | "party" | "unknown";

export const DEMO_INGESTION_STATUS_VALUES = [
  "queued",
  "parsing",
  "parsed",
  "failed",
  "source_unavailable",
] as const;
export type DemoIngestionStatus = (typeof DEMO_INGESTION_STATUS_VALUES)[number];

export const DEMO_ANALYTICS_SOURCE_TYPE_VALUES = [
  "faceit_demo_url",
  "manual_upload",
] as const;
export type DemoAnalyticsSourceType = (typeof DEMO_ANALYTICS_SOURCE_TYPE_VALUES)[number];

export const DEMO_ANALYTICS_AVAILABILITY_VALUES = ["available", "unavailable"] as const;
export type DemoAnalyticsAvailability = (typeof DEMO_ANALYTICS_AVAILABILITY_VALUES)[number];
export type DemoTeamKey = "team1" | "team2";

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
  krRatio: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  result: boolean; // win or loss
  damage: number;
  firstKills: number;
  entryCount: number;
  entryWins: number;
  clutchKills: number;
  oneV1Count: number;
  oneV1Wins: number;
  oneV2Count: number;
  oneV2Wins: number;
  doubleKills: number;
  utilityDamage: number;
  enemiesFlashed: number;
  flashCount: number;
  sniperKills: number;
  pistolKills: number;
}

export interface PlayerHistoryMatch extends MatchPlayerStats {
  matchId: string;
  map: string;
  score: string;
  startedAt: number;
  finishedAt: number | null;
  queueBucket: MatchQueueBucket;
  knownQueuedFriendCount: number;
  knownQueuedFriendIds: string[];
  partySize: number | null;
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

export interface MatchDetail {
  matchId: string;
  map: string;
  score: string;
  status: MatchStatus;
  startedAt: number;
  finishedAt: number | null;
  players: MatchPlayerStats[];
  demoUrl: string | null;
  teams: {
    faction1: { name: string; score: number; playerIds: string[] };
    faction2: { name: string; score: number; playerIds: string[] };
  };
  rounds: number;
  region: string;
  competitionName: string;
}

export interface DemoPlayerAnalytics {
  nickname: string;
  teamKey: DemoTeamKey;
  tradeKills: number;
  tradedDeaths: number;
  untradedDeaths: number;
  rws: number;
  playerId?: string;
  steamId?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  headshots?: number;
  adr?: number;
  hsPercent?: number;
  damage?: number;
  entryKills?: number;
  entryDeaths?: number;
  openingDuelAttempts?: number;
  openingDuelWins?: number;
  exitKills?: number;
  clutchAttempts?: number;
  clutchWins?: number;
  lastAliveRounds?: number;
  bombPlants?: number;
  bombDefuses?: number;
  utilityDamage?: number;
  flashAssists?: number;
  enemiesFlashed?: number;
  kastPercent?: number;
  rating?: number;
  multiKills?: { threeK: number; fourK: number; ace: number };
  killTimings?: { early: number; mid: number; late: number };
  // Utility mastery
  smokesThrown?: number;
  flashesThrown?: number;
  hesThrown?: number;
  molotovsThrown?: number;
  utilityPerRound?: number;
  avgFlashBlindDuration?: number;
  teamFlashes?: number;
  effectiveFlashRate?: number;
  // Kill quality
  wallbangKills?: number;
  thrusmokeKills?: number;
  noscopeKills?: number;
  avgKillDistance?: number;
  weaponKills?: Record<string, number>;
  // Economy
  totalSpend?: number;
  economyEfficiency?: number;
  weaponRounds?: Record<string, number>;
  // Side-split
  ctKills?: number;
  ctDeaths?: number;
  ctAdr?: number;
  ctRating?: number;
  tKills?: number;
  tDeaths?: number;
  tAdr?: number;
  tRating?: number;
}

export interface DemoTeamAnalytics {
  teamKey: DemoTeamKey;
  name: string;
  side: "CT" | "T" | "unknown";
  roundsWon: number;
  roundsLost: number;
  tradeKills: number;
  untradedDeaths: number;
  rws: number;
}

export interface DemoRoundAnalytics {
  roundNumber: number;
  winnerTeamKey: DemoTeamKey | null;
  winnerSide: "CT" | "T" | null;
  isPistolRound: boolean;
  isBombRound: boolean;
  scoreAfterRound: Record<DemoTeamKey, number>;
  tTeamKey?: DemoTeamKey;
  ctTeamKey?: DemoTeamKey;
  tBuyType?: string;
  ctBuyType?: string;
  endReason?: string | null;
  bombPlanted?: boolean;
  bombDefused?: boolean;
  planterSteamId?: string | null;
  defuserSteamId?: string | null;
  tEquipValue?: number;
  ctEquipValue?: number;
}

export interface DemoMatchAnalytics {
  matchId: string;
  sourceType: DemoAnalyticsSourceType;
  availability: DemoAnalyticsAvailability;
  ingestionStatus: DemoIngestionStatus;
  mapName: string;
  totalRounds: number;
  rounds: DemoRoundAnalytics[];
  teams: DemoTeamAnalytics[];
  players: DemoPlayerAnalytics[];
}

export interface MatchDetailWithDemoAnalytics extends MatchDetail {
  demoAnalytics: DemoMatchAnalytics | null;
}

export interface TwitchStream {
  channel: string;
  faceitId: string;
  isLive: boolean;
  viewerCount: number;
  title: string;
  thumbnailUrl: string;
}

export type BetSide = "team1" | "team2";
export type BettingPoolStatus = "OPEN" | "CLOSED" | "RESOLVED" | "REFUNDED";

export interface BettingPool {
  id: string;
  faceitMatchId: string;
  status: BettingPoolStatus;
  team1Name: string;
  team2Name: string;
  team1Pool: number;
  team2Pool: number;
  winningTeam: BetSide | null;
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
}

export interface BetAuditEvent {
  id: string;
  betId: string;
  poolId: string;
  faceitMatchId: string;
  userId: string;
  side: BetSide;
  amount: number;
  betCreatedAt: string;
  matchStartedAt: string | null;
  secondsSinceMatchStart: number | null;
  capturedPoolStatus: BettingPoolStatus;
  createdAt: string;
}

export interface Bet {
  id: string;
  poolId: string;
  userId: string;
  side: BetSide;
  amount: number;
  payout: number | null;
  createdAt: string;
}

export interface BetWithPool extends Bet {
  pool: BettingPool;
  audit?: BetAuditEvent | null;
}

export interface BettingLeaderboardEntry {
  userId: string;
  nickname: string;
  coins: number;
  betsPlaced: number;
  betsWon: number;
  resolvedBets: number;
  totalWagered: number;
  totalReturned: number;
  netProfit: number;
  winRate: number;
}

export interface BetHistorySummary {
  coins: number;
  betsPlaced: number;
  betsWon: number;
  resolvedBets: number;
  refundedBets: number;
  pendingBets: number;
  totalWagered: number;
  totalReturned: number;
  netProfit: number;
  winRate: number;
}

export interface StatsLeaderboardEntry {
  faceitId: string;
  nickname: string;
  elo: number;
  gamesPlayed: number;
  avgImpact: number;
  avgKills: number;
  avgKd: number;
  avgAdr: number;
  winRate: number;       // 0–100
  avgHsPercent: number;  // 0–100
  avgKrRatio: number;
  avgFirstKills: number;
  avgClutchKills: number;
  avgUtilityDamage: number;
  avgEnemiesFlashed: number;
  avgEntryRate: number;  // 0–1
  avgSniperKills: number;
}

export interface StatsLeaderboardResult {
  entries: StatsLeaderboardEntry[];
  targetMatchCount: number;
  sharedFriendCount: number;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  coins: number;
  betsPlaced: number;
  betsWon: number;
}
