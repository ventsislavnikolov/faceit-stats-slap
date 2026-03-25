// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoPlayerRow {
  adr_demo: number;
  assists: number;
  bomb_defuses: number;
  bomb_plants: number;
  clutch_attempts: number;
  clutch_wins: number;
  deaths: number;
  entry_deaths: number;
  entry_kills: number;
  exit_kills: number;
  faceit_player_id: string;
  flash_assists_demo: number;
  hs_percent_demo: number;
  kills: number;
  last_alive_rounds: number;
  nickname: string;
  opening_duel_attempts: number;
  opening_duel_wins: number;
  rws: number;
  trade_kills: number;
  traded_deaths: number;
  untraded_deaths: number;
  utility_damage_demo: number;
}

export interface DemoPlayerSummary {
  avgAdr: number;
  avgAssists: number;
  avgDeaths: number;
  avgFlashAssists: number;
  avgHsPercent: number;

  // Averages
  avgKills: number;
  avgRws: number;
  avgUtilityDamage: number;
  clutchWinRate: number;
  nickname: string;

  // Derived rates
  openingDuelWinRate: number;
  playerId: string;
  sampleMatchCount: number;
  totalBombDefuses: number;
  totalBombPlants: number;
  totalClutchAttempts: number;
  totalClutchWins: number;
  totalEntryDeaths: number;
  totalEntryKills: number;
  totalExitKills: number;
  totalLastAliveRounds: number;
  totalOpeningDuelAttempts: number;
  totalOpeningDuelWins: number;
  totalTradedDeaths: number;

  // Totals
  totalTradeKills: number;
  totalUntradedDeaths: number;
}

// ---------------------------------------------------------------------------
// Pure aggregation (no DB dependency)
// ---------------------------------------------------------------------------

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function aggregatePlayerDemoSummary(
  rows: DemoPlayerRow[]
): DemoPlayerSummary | null {
  if (rows.length === 0) {
    return null;
  }

  const lastRow = rows[rows.length - 1];

  const totalOpeningDuelAttempts = sum(
    rows.map((r) => Number(r.opening_duel_attempts))
  );
  const totalOpeningDuelWins = sum(
    rows.map((r) => Number(r.opening_duel_wins))
  );
  const totalClutchAttempts = sum(rows.map((r) => Number(r.clutch_attempts)));
  const totalClutchWins = sum(rows.map((r) => Number(r.clutch_wins)));

  return {
    playerId: String(lastRow.faceit_player_id),
    nickname: String(lastRow.nickname),
    sampleMatchCount: rows.length,

    avgKills: avg(rows.map((r) => Number(r.kills))),
    avgDeaths: avg(rows.map((r) => Number(r.deaths))),
    avgAssists: avg(rows.map((r) => Number(r.assists))),
    avgAdr: avg(rows.map((r) => Number(r.adr_demo))),
    avgHsPercent: avg(rows.map((r) => Number(r.hs_percent_demo))),
    avgRws: avg(rows.map((r) => Number(r.rws))),
    avgUtilityDamage: avg(rows.map((r) => Number(r.utility_damage_demo))),
    avgFlashAssists: avg(rows.map((r) => Number(r.flash_assists_demo))),

    totalTradeKills: sum(rows.map((r) => Number(r.trade_kills))),
    totalTradedDeaths: sum(rows.map((r) => Number(r.traded_deaths))),
    totalUntradedDeaths: sum(rows.map((r) => Number(r.untraded_deaths))),
    totalEntryKills: sum(rows.map((r) => Number(r.entry_kills))),
    totalEntryDeaths: sum(rows.map((r) => Number(r.entry_deaths))),
    totalExitKills: sum(rows.map((r) => Number(r.exit_kills))),
    totalClutchAttempts,
    totalClutchWins,
    totalLastAliveRounds: sum(rows.map((r) => Number(r.last_alive_rounds))),
    totalBombPlants: sum(rows.map((r) => Number(r.bomb_plants))),
    totalBombDefuses: sum(rows.map((r) => Number(r.bomb_defuses))),
    totalOpeningDuelAttempts,
    totalOpeningDuelWins,

    openingDuelWinRate: safeRate(
      totalOpeningDuelWins,
      totalOpeningDuelAttempts
    ),
    clutchWinRate: safeRate(totalClutchWins, totalClutchAttempts),
  };
}

// ---------------------------------------------------------------------------
// Supabase query wrapper
// ---------------------------------------------------------------------------

interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

interface SupabaseLike {
  from(table: string): {
    select(columns?: string): {
      eq(
        column: string,
        value: unknown
      ): {
        order(
          column: string,
          options?: { ascending: boolean }
        ): PromiseLike<SupabaseResult<DemoPlayerRow[]>>;
      };
    };
  };
}

export async function getPlayerDemoSummary(
  supabase: SupabaseLike,
  faceitPlayerId: string
): Promise<DemoPlayerSummary | null> {
  const { data, error } = await supabase
    .from("demo_player_analytics")
    .select("*")
    .eq("faceit_player_id", faceitPlayerId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  return aggregatePlayerDemoSummary(data);
}
