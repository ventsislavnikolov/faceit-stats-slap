import type {
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  DemoAnalyticsSourceType,
  DemoIngestionStatus,
  DemoTeamKey,
} from "~/lib/types";

// ---------------------------------------------------------------------------
// Supabase interface (keeps the module testable without a real client)
// ---------------------------------------------------------------------------

interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseLike {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): PromiseLike<SupabaseResult> & {
      select(columns: string): {
        single(): PromiseLike<SupabaseResult<{ id: string }>>;
      };
    };
    upsert(
      rows: Record<string, unknown>[],
      options?: { onConflict?: string },
    ): PromiseLike<SupabaseResult>;
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<SupabaseResult>;
    };
  };
}

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

export interface CreateIngestionInput {
  faceitMatchId: string;
  sourceType: DemoAnalyticsSourceType;
  sourceUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileSha256: string;
  compression?: "dem" | "zst";
  parserVersion?: string | null;
  demoPatchVersion?: string | null;
}

export interface IngestionRow {
  id: string;
}

// ---------------------------------------------------------------------------
// Ingestion lifecycle
// ---------------------------------------------------------------------------

export async function upsertDemoIngestion(
  supabase: SupabaseLike,
  input: CreateIngestionInput,
): Promise<IngestionRow> {
  const { data, error } = await supabase
    .from("demo_ingestions")
    .insert([
      {
        faceit_match_id: input.faceitMatchId,
        source_type: input.sourceType,
        source_url: input.sourceUrl ?? null,
        file_name: input.fileName ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
        file_sha256: input.fileSha256,
        compression: input.compression ?? "dem",
        status: "queued" satisfies DemoIngestionStatus,
        parser_version: input.parserVersion ?? null,
        demo_patch_version: input.demoPatchVersion ?? null,
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(`upsertDemoIngestion failed: ${error.message}`);
  return { id: data!.id };
}

export async function markDemoIngestionParsing(
  supabase: SupabaseLike,
  ingestionId: string,
  startedAt?: string,
): Promise<void> {
  const { error } = await supabase
    .from("demo_ingestions")
    .update({
      status: "parsing" satisfies DemoIngestionStatus,
      started_at: startedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ingestionId);

  if (error) throw new Error(`markDemoIngestionParsing failed: ${error.message}`);
}

export async function markDemoIngestionFailed(
  supabase: SupabaseLike,
  ingestionId: string,
  errorMessage: string,
  finishedAt?: string,
): Promise<void> {
  const { error } = await supabase
    .from("demo_ingestions")
    .update({
      status: "failed" satisfies DemoIngestionStatus,
      error_message: errorMessage,
      finished_at: finishedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ingestionId);

  if (error) throw new Error(`markDemoIngestionFailed failed: ${error.message}`);
}

export async function markDemoIngestionParsed(
  supabase: SupabaseLike,
  ingestionId: string,
  finishedAt?: string,
): Promise<void> {
  const { error } = await supabase
    .from("demo_ingestions")
    .update({
      status: "parsed" satisfies DemoIngestionStatus,
      finished_at: finishedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ingestionId);

  if (error) throw new Error(`markDemoIngestionParsed failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Analytics persistence — aligned to 007_demo_analytics.sql
// ---------------------------------------------------------------------------

function deriveWinner(teams: DemoTeamAnalytics[]): DemoTeamKey | null {
  const t1 = teams.find((t) => t.teamKey === "team1");
  const t2 = teams.find((t) => t.teamKey === "team2");
  if (!t1 || !t2) return null;
  if (t1.roundsWon > t2.roundsWon) return "team1";
  if (t2.roundsWon > t1.roundsWon) return "team2";
  return null;
}

function buildMatchRow(ingestionId: string, a: DemoMatchAnalytics) {
  const t1 = a.teams.find((t) => t.teamKey === "team1");
  const t2 = a.teams.find((t) => t.teamKey === "team2");

  return {
    ingestion_id: ingestionId,
    faceit_match_id: a.matchId,
    map_name: a.mapName,
    server_name: null,
    demo_source_type: a.sourceType,
    total_rounds: a.totalRounds,
    winner_team_key: deriveWinner(a.teams),
    team1_name: t1?.name ?? "Team 1",
    team2_name: t2?.name ?? "Team 2",
    team1_score: t1?.roundsWon ?? 0,
    team2_score: t2?.roundsWon ?? 0,
    team1_first_half_side: t1?.side ?? "unknown",
    team2_first_half_side: t2?.side ?? "unknown",
    longest_team1_win_streak: 0,
    longest_team2_win_streak: 0,
    ingestion_status: a.ingestionStatus,
    parsed_at: new Date().toISOString(),
  };
}

function buildTeamRow(demoMatchId: string, matchId: string, team: DemoTeamAnalytics) {
  return {
    demo_match_id: demoMatchId,
    faceit_match_id: matchId,
    team_key: team.teamKey,
    name: team.name,
    first_half_side: team.side ?? "unknown",
    trade_rate: 0,
    opening_duel_win_rate: 0,
    rounds_won: team.roundsWon,
    rounds_lost: team.roundsLost,
    longest_win_streak: 0,
    longest_loss_streak: 0,
  };
}

function buildPlayerRow(demoMatchId: string, matchId: string, player: DemoPlayerAnalytics) {
  return {
    demo_match_id: demoMatchId,
    faceit_match_id: matchId,
    faceit_player_id: player.playerId ?? null,
    steam_id: player.steamId ?? null,
    nickname: player.nickname,
    team_key: player.teamKey,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    assists: player.assists ?? 0,
    adr_demo: player.adr ?? 0,
    hs_percent_demo: player.hsPercent ?? 0,
    rating_demo: null,
    entry_kills: player.entryKills ?? 0,
    entry_deaths: player.entryDeaths ?? 0,
    opening_duel_attempts: player.openingDuelAttempts ?? 0,
    opening_duel_wins: player.openingDuelWins ?? 0,
    trade_kills: player.tradeKills ?? 0,
    traded_deaths: player.tradedDeaths ?? 0,
    untraded_deaths: player.untradedDeaths ?? 0,
    exit_kills: player.exitKills ?? 0,
    clutch_attempts: player.clutchAttempts ?? 0,
    clutch_wins: player.clutchWins ?? 0,
    last_alive_rounds: player.lastAliveRounds ?? 0,
    bomb_plants: player.bombPlants ?? 0,
    bomb_defuses: player.bombDefuses ?? 0,
    utility_damage_demo: player.utilityDamage ?? 0,
    flash_assists_demo: player.flashAssists ?? 0,
    enemies_flashed: player.enemiesFlashed ?? 0,
    rws: player.rws ?? 0,
    rating_demo: player.rating ?? null,
    kast_percent: player.kastPercent ?? 0,
    kill_timing_early: player.killTimings?.early ?? 0,
    kill_timing_mid: player.killTimings?.mid ?? 0,
    kill_timing_late: player.killTimings?.late ?? 0,
    multi_kill_3k: player.multiKills?.threeK ?? 0,
    multi_kill_4k: player.multiKills?.fourK ?? 0,
    multi_kill_ace: player.multiKills?.ace ?? 0,
  };
}

function buildRoundRow(demoMatchId: string, matchId: string, round: DemoRoundAnalytics) {
  return {
    demo_match_id: demoMatchId,
    faceit_match_id: matchId,
    round_number: round.roundNumber,
    winner_team_key: round.winnerTeamKey,
    score_team1: round.scoreAfterRound.team1,
    score_team2: round.scoreAfterRound.team2,
    t_team_key: round.tTeamKey ?? "team2",
    ct_team_key: round.ctTeamKey ?? "team1",
    t_buy_type: round.tBuyType ?? "unknown",
    ct_buy_type: round.ctBuyType ?? "unknown",
    is_pistol: round.isPistolRound,
    end_reason: round.endReason ?? null,
    bomb_planted: round.bombPlanted ?? false,
    bomb_defused: round.bombDefused ?? false,
    planter_steam_id: round.planterSteamId ?? null,
    defuser_steam_id: round.defuserSteamId ?? null,
  };
}

export async function saveDemoAnalytics(
  supabase: SupabaseLike,
  ingestionId: string,
  analytics: DemoMatchAnalytics,
): Promise<{ demoMatchId: string }> {
  // 1. Insert match analytics → get id for FK chain
  const { data: matchData, error: matchError } = await supabase
    .from("demo_match_analytics")
    .insert([buildMatchRow(ingestionId, analytics)])
    .select("id")
    .single();

  if (matchError) throw new Error(`saveDemoAnalytics match insert failed: ${matchError.message}`);
  const demoMatchId = matchData!.id;

  // 2. Teams
  if (analytics.teams.length > 0) {
    const { error } = await supabase.from("demo_team_analytics").upsert(
      analytics.teams.map((t) => buildTeamRow(demoMatchId, analytics.matchId, t)),
      { onConflict: "faceit_match_id,team_key" },
    );
    if (error) throw new Error(`saveDemoAnalytics team upsert failed: ${error.message}`);
  }

  // 3. Players
  if (analytics.players.length > 0) {
    const { error } = await supabase
      .from("demo_player_analytics")
      .insert(analytics.players.map((p) => buildPlayerRow(demoMatchId, analytics.matchId, p)));
    if (error) throw new Error(`saveDemoAnalytics player insert failed: ${error.message}`);
  }

  // 4. Rounds
  if (analytics.rounds.length > 0) {
    const { error } = await supabase
      .from("demo_round_analytics")
      .insert(analytics.rounds.map((r) => buildRoundRow(demoMatchId, analytics.matchId, r)));
    if (error) throw new Error(`saveDemoAnalytics round insert failed: ${error.message}`);
  }

  return { demoMatchId };
}
