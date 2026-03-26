export type MatchStatus =
  | "ONGOING"
  | "READY"
  | "VOTING"
  | "CONFIGURING"
  | "FINISHED"
  | "CANCELLED";
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
export type DemoAnalyticsSourceType =
  (typeof DEMO_ANALYTICS_SOURCE_TYPE_VALUES)[number];

export const DEMO_ANALYTICS_AVAILABILITY_VALUES = [
  "available",
  "unavailable",
] as const;
export type DemoAnalyticsAvailability =
  (typeof DEMO_ANALYTICS_AVAILABILITY_VALUES)[number];
export type DemoTeamKey = "team1" | "team2";

export interface FaceitPlayer {
  avatar: string;
  country: string;
  elo: number;
  faceitId: string;
  nickname: string;
  skillLevel: number;
}

export interface FriendWithStats extends FaceitPlayer {
  currentMatchId: string | null;
  isPlaying: boolean;
  lifetimeAdr: number;
  lifetimeHs: number;
  lifetimeKd: number;
  recentResults: boolean[]; // true = win, false = loss (last 5)
  totalMatches: number;
  twitchChannel: string | null;
  winRate: number;
}

export interface LiveMatch {
  friendFaction: "faction1" | "faction2";
  friendIds: string[];
  map: string;
  matchId: string;
  score: { faction1: number; faction2: number };
  startedAt: number;
  status: MatchStatus;
  teams: {
    faction1: MatchTeam;
    faction2: MatchTeam;
  };
}

export interface MatchTeam {
  name: string;
  roster: MatchPlayer[];
  teamId: string;
}

export interface MatchPlayer {
  avatar: string;
  nickname: string;
  playerId: string;
  skillLevel: number;
}

export interface MatchPlayerStats {
  adr: number;
  assists: number;
  clutchKills: number;
  damage: number;
  deaths: number;
  doubleKills: number;
  enemiesFlashed: number;
  entryCount: number;
  entryWins: number;
  firstKills: number;
  flashCount: number;
  headshots: number;
  hsPercent: number;
  kdRatio: number;
  kills: number;
  krRatio: number;
  mvps: number;
  nickname: string;
  oneV1Count: number;
  oneV1Wins: number;
  oneV2Count: number;
  oneV2Wins: number;
  pentaKills: number;
  pistolKills: number;
  playerId: string;
  quadroKills: number;
  result: boolean; // win or loss
  sniperKills: number;
  tripleKills: number;
  utilityDamage: number;
}

export interface PlayerHistoryMatch extends MatchPlayerStats {
  finishedAt: number | null;
  hasDemoAnalytics?: boolean;
  knownQueuedFriendCount: number;
  knownQueuedFriendIds: string[];
  map: string;
  matchId: string;
  partySize: number | null;
  queueBucket: MatchQueueBucket;
  score: string;
  startedAt: number;
}

export interface MatchWithStats {
  finishedAt: number | null;
  map: string;
  matchId: string;
  players: MatchPlayerStats[];
  score: string;
  startedAt: number;
  status: MatchStatus;
}

export interface MatchDetail {
  competitionName: string;
  demoUrl: string | null;
  finishedAt: number | null;
  map: string;
  matchId: string;
  players: MatchPlayerStats[];
  region: string;
  rounds: number;
  score: string;
  startedAt: number;
  status: MatchStatus;
  teams: {
    faction1: { name: string; score: number; playerIds: string[] };
    faction2: { name: string; score: number; playerIds: string[] };
  };
}

export interface DemoPlayerAnalytics {
  adr?: number;
  assists?: number;
  avgFlashBlindDuration?: number;
  avgKillDistance?: number;
  bombDefuses?: number;
  bombPlants?: number;
  clutchAttempts?: number;
  clutchWins?: number;
  ctAdr?: number;
  ctDeaths?: number;
  // Side-split
  ctKills?: number;
  ctRating?: number;
  damage?: number;
  deaths?: number;
  economyEfficiency?: number;
  effectiveFlashRate?: number;
  enemiesFlashed?: number;
  entryDeaths?: number;
  entryKills?: number;
  exitKills?: number;
  flashAssists?: number;
  flashesThrown?: number;
  headshots?: number;
  hesThrown?: number;
  hsPercent?: number;
  kastPercent?: number;
  kills?: number;
  killTimings?: { early: number; mid: number; late: number };
  lastAliveRounds?: number;
  molotovsThrown?: number;
  multiKills?: { threeK: number; fourK: number; ace: number };
  nickname: string;
  noscopeKills?: number;
  openingDuelAttempts?: number;
  openingDuelWins?: number;
  playerId?: string;
  rating?: number;
  rws: number;
  // Utility mastery
  smokesThrown?: number;
  steamId?: string;
  tAdr?: number;
  tDeaths?: number;
  teamFlashes?: number;
  teamKey: DemoTeamKey;
  thrusmokeKills?: number;
  tKills?: number;
  // Economy
  totalSpend?: number;
  tRating?: number;
  tradedDeaths: number;
  tradeKills: number;
  untradedDeaths: number;
  utilityDamage?: number;
  utilityPerRound?: number;
  // Kill quality
  wallbangKills?: number;
  weaponKills?: Record<string, number>;
  weaponRounds?: Record<string, number>;
}

export interface DemoTeamAnalytics {
  name: string;
  roundsLost: number;
  roundsWon: number;
  rws: number;
  side: "CT" | "T" | "unknown";
  teamKey: DemoTeamKey;
  tradeKills: number;
  untradedDeaths: number;
}

export interface DemoRoundAnalytics {
  bombDefused?: boolean;
  bombPlanted?: boolean;
  ctBuyType?: string;
  ctEquipValue?: number;
  ctTeamKey?: DemoTeamKey;
  defuserSteamId?: string | null;
  endReason?: string | null;
  isBombRound: boolean;
  isPistolRound: boolean;
  planterSteamId?: string | null;
  roundNumber: number;
  scoreAfterRound: Record<DemoTeamKey, number>;
  tBuyType?: string;
  tEquipValue?: number;
  tTeamKey?: DemoTeamKey;
  winnerSide: "CT" | "T" | null;
  winnerTeamKey: DemoTeamKey | null;
}

export interface DemoMatchAnalytics {
  availability: DemoAnalyticsAvailability;
  ingestionStatus: DemoIngestionStatus;
  mapName: string;
  matchId: string;
  players: DemoPlayerAnalytics[];
  rounds: DemoRoundAnalytics[];
  sourceType: DemoAnalyticsSourceType;
  teams: DemoTeamAnalytics[];
  totalRounds: number;
}

export interface MatchDetailWithDemoAnalytics extends MatchDetail {
  demoAnalytics: DemoMatchAnalytics | null;
}

export interface TwitchStream {
  channel: string;
  faceitId: string;
  isLive: boolean;
  thumbnailUrl: string;
  title: string;
  viewerCount: number;
}

export type BetSide = "team1" | "team2";
export type BettingPoolStatus = "OPEN" | "CLOSED" | "RESOLVED" | "REFUNDED";

export interface BettingPool {
  closesAt: string;
  faceitMatchId: string;
  id: string;
  opensAt: string;
  resolvedAt: string | null;
  status: BettingPoolStatus;
  team1Name: string;
  team1Pool: number;
  team2Name: string;
  team2Pool: number;
  winningTeam: BetSide | null;
}

export interface BetAuditEvent {
  amount: number;
  betCreatedAt: string;
  betId: string;
  capturedPoolStatus: BettingPoolStatus;
  createdAt: string;
  faceitMatchId: string;
  id: string;
  matchStartedAt: string | null;
  poolId: string;
  secondsSinceMatchStart: number | null;
  side: BetSide;
  userId: string;
}

export interface Bet {
  amount: number;
  createdAt: string;
  id: string;
  payout: number | null;
  poolId: string;
  side: BetSide;
  userId: string;
}

export interface BetWithPool extends Bet {
  audit?: BetAuditEvent | null;
  pool: BettingPool;
}

export interface BettingLeaderboardEntry {
  betsPlaced: number;
  betsWon: number;
  coins: number;
  netProfit: number;
  nickname: string;
  resolvedBets: number;
  totalReturned: number;
  totalWagered: number;
  userId: string;
  winRate: number;
}

export interface BetHistorySummary {
  betsPlaced: number;
  betsWon: number;
  coins: number;
  netProfit: number;
  pendingBets: number;
  refundedBets: number;
  resolvedBets: number;
  totalReturned: number;
  totalWagered: number;
  winRate: number;
}

export interface StatsLeaderboardEntry {
  avgAdr: number;
  avgClutchKills: number;
  avgEnemiesFlashed: number;
  avgEntryRate: number; // 0–1
  avgFirstKills: number;
  avgHsPercent: number; // 0–100
  avgImpact: number;
  avgKd: number;
  avgKills: number;
  avgKrRatio: number;
  avgSniperKills: number;
  avgUtilityDamage: number;
  elo: number;
  faceitId: string;
  gamesPlayed: number;
  nickname: string;
  winRate: number; // 0–100
}

export interface StatsLeaderboardResult {
  entries: StatsLeaderboardEntry[];
  sharedFriendCount: number;
  targetMatchCount: number;
}

export interface LeaderboardEntry {
  betsPlaced: number;
  betsWon: number;
  coins: number;
  nickname: string;
  userId: string;
}

export interface AggregatePlayerStats {
  avgAdr: number;
  avgEconomyEfficiency?: number;
  avgEnemiesFlashed?: number;
  avgEntryRate?: number;
  avgHsPercent: number;
  avgImpact: number;
  avgKast?: number;
  avgKd: number;
  avgKrRatio: number;
  // Demo-only (present when allHaveDemo)
  avgRating?: number;
  avgRws?: number;
  avgTradeKills?: number;
  avgUtilityDamage?: number;
  faceitId: string;
  gamesPlayed: number;
  nickname: string;
  totalClutchWins?: number;
  totalMvps: number;
  totalPentaKills: number;
  totalQuadroKills: number;
  totalTripleKills: number;
  wins: number;
}

export interface SessionAward {
  banter?: string;
  id: string;
  recipient: string;
  requiresDemo: boolean;
  title: string;
  value: string;
}

export interface MapStats {
  gamesPlayed: number;
  losses: number;
  map: string;
  winRate: number;
  wins: number;
}

export interface PartySessionData {
  aggregateStats: Record<string, AggregatePlayerStats>;
  allHaveDemo: boolean;
  awards: SessionAward[];
  date: string;
  demoMatches: Record<string, DemoMatchAnalytics>;
  eloMap: Record<string, number>;
  lossCount: number;
  mapDistribution: MapStats[];
  matches: PlayerHistoryMatch[];
  matchStats: Record<string, MatchPlayerStats[]>;
  partyMembers: Array<Pick<FaceitPlayer, "faceitId" | "nickname">>;
  totalHoursPlayed: number;
  winCount: number;
}
