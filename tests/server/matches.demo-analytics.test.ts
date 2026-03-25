import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import { getMatchDetails } from "~/server/matches";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const faceitMocks = vi.hoisted(() => ({
  fetchPlayer: vi.fn(),
  fetchPlayerHistory: vi.fn(),
  fetchMatch: vi.fn(),
  fetchMatchStats: vi.fn(),
  pickRelevantHistoryMatch: vi.fn(),
  parseMatchStats: vi.fn(),
  parseMatchTeamScore: vi.fn(),
  buildMatchScoreString: vi.fn(),
}));

const webhookMocks = vi.hoisted(() => ({
  getWebhookLiveMatchMap: vi.fn(),
}));

const supabaseState = vi.hoisted(() => {
  const matchesUpsert = vi.fn(async () => ({ data: null, error: null }));
  const matchPlayerStatsUpsert = vi.fn(async () => ({ data: null, error: null }));

  let matchRow: { id: string } | null = { id: "db-match-1" };

  // Demo analytics query results
  let demoMatchAnalyticsRow: Record<string, unknown> | null = null;
  let demoTeamAnalyticsRows: Record<string, unknown>[] = [];
  let demoPlayerAnalyticsRows: Record<string, unknown>[] = [];
  let demoRoundAnalyticsRows: Record<string, unknown>[] = [];
  let demoIngestionRow: Record<string, unknown> | null = null;

  const from = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        upsert: matchesUpsert,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: matchRow })),
          })),
          in: vi.fn(async () => ({ data: [] })),
        })),
      };
    }
    if (table === "match_player_stats") {
      return { upsert: matchPlayerStatsUpsert };
    }
    if (table === "demo_match_analytics") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: demoMatchAnalyticsRow,
              error: demoMatchAnalyticsRow ? null : { message: "not found", code: "PGRST116" },
            })),
          })),
        })),
      };
    }
    if (table === "demo_team_analytics") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: demoTeamAnalyticsRows,
            error: null,
          })),
        })),
      };
    }
    if (table === "demo_player_analytics") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: demoPlayerAnalyticsRows,
            error: null,
          })),
        })),
      };
    }
    if (table === "demo_round_analytics") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: demoRoundAnalyticsRows,
              error: null,
            })),
          })),
        })),
      };
    }
    if (table === "demo_ingestions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: demoIngestionRow,
                  error: demoIngestionRow ? null : { message: "not found", code: "PGRST116" },
                })),
              })),
            })),
          })),
        })),
      };
    }
    // Fallback for betting_pools etc
    return {
      insert: vi.fn(() => ({ onConflict: vi.fn(() => ({ ignore: vi.fn(async () => ({ data: null, error: null })) })) })),
      select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [] })) })),
    };
  });

  return {
    createSupabase: () => ({ from }),
    from,
    matchesUpsert,
    matchPlayerStatsUpsert,
    setMatchRow(v: { id: string } | null) { matchRow = v; },
    setDemoMatchAnalytics(v: Record<string, unknown> | null) { demoMatchAnalyticsRow = v; },
    setDemoTeamAnalytics(v: Record<string, unknown>[]) { demoTeamAnalyticsRows = v; },
    setDemoPlayerAnalytics(v: Record<string, unknown>[]) { demoPlayerAnalyticsRows = v; },
    setDemoRoundAnalytics(v: Record<string, unknown>[]) { demoRoundAnalyticsRows = v; },
    setDemoIngestion(v: Record<string, unknown> | null) { demoIngestionRow = v; },
    reset() {
      matchRow = { id: "db-match-1" };
      demoMatchAnalyticsRow = null;
      demoTeamAnalyticsRows = [];
      demoPlayerAnalyticsRows = [];
      demoRoundAnalyticsRows = [];
      demoIngestionRow = null;
      matchesUpsert.mockClear();
      matchPlayerStatsUpsert.mockClear();
      from.mockClear();
    },
  };
});

vi.mock("~/lib/faceit", async () => {
  const actual = await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
  return {
    ...actual,
    fetchPlayer: faceitMocks.fetchPlayer,
    fetchPlayerHistory: faceitMocks.fetchPlayerHistory,
    fetchMatch: faceitMocks.fetchMatch,
    fetchMatchStats: faceitMocks.fetchMatchStats,
    pickRelevantHistoryMatch: faceitMocks.pickRelevantHistoryMatch,
    parseMatchStats: faceitMocks.parseMatchStats,
    parseMatchTeamScore: faceitMocks.parseMatchTeamScore,
    buildMatchScoreString: faceitMocks.buildMatchScoreString,
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => supabaseState.createSupabase(),
}));

vi.mock("~/server/faceit-webhooks", () => ({
  getWebhookLiveMatchMap: webhookMocks.getWebhookLiveMatchMap,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParsedPlayer(playerId: string, nickname: string) {
  return {
    playerId,
    nickname,
    kills: 20,
    deaths: 10,
    assists: 5,
    headshots: 8,
    mvps: 2,
    kdRatio: 2,
    adr: 90,
    hsPercent: 40,
    krRatio: 0.8,
    tripleKills: 1,
    quadroKills: 0,
    pentaKills: 0,
    result: true,
    damage: 1800,
    firstKills: 1,
    entryCount: 2,
    entryWins: 1,
    clutchKills: 1,
    oneV1Count: 1,
    oneV1Wins: 1,
    oneV2Count: 0,
    oneV2Wins: 0,
    doubleKills: 2,
    utilityDamage: 100,
    enemiesFlashed: 5,
    flashCount: 10,
    sniperKills: 3,
    pistolKills: 2,
  };
}

function setupFinishedMatch() {
  faceitMocks.fetchMatch.mockResolvedValue({
    match_id: "match-1",
    status: "FINISHED",
    started_at: 1710000000,
    finished_at: 1710000900,
    demo_url: ["https://demo.test/demo.dem.zst"],
    teams: { faction1: { name: "Alpha" }, faction2: { name: "Bravo" } },
    voting: { map: { pick: ["de_inferno"] } },
    region: "EU",
    competition_name: "Ranked",
  });
  faceitMocks.fetchMatchStats.mockResolvedValue({
    rounds: [
      {
        round_stats: { Map: "de_inferno", Score: "13 / 7", Rounds: "20", Region: "EU" },
        teams: [
          { team_stats: { Team: "Alpha" }, players: [{ player_id: "p1" }] },
          { team_stats: { Team: "Bravo" }, players: [{ player_id: "p2" }] },
        ],
      },
    ],
  });
  faceitMocks.parseMatchStats
    .mockReturnValueOnce(buildParsedPlayer("p1", "Player1"))
    .mockReturnValueOnce(buildParsedPlayer("p2", "Player2"));
  faceitMocks.parseMatchTeamScore.mockReturnValueOnce(13).mockReturnValueOnce(7);
  faceitMocks.buildMatchScoreString.mockReturnValue("13 / 7");
}

function callGetMatchDetails(matchId = "match-1") {
  return runWithStartContext(
    { contextAfterGlobalMiddlewares: {}, request: new Request("http://localhost") } as any,
    () => getMatchDetails({ data: matchId } as any),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  supabaseState.reset();
  vi.clearAllMocks();
});

describe("getMatchDetails — demo analytics merge", () => {
  it("returns demoAnalytics: null when no parsed demo exists", async () => {
    setupFinishedMatch();
    supabaseState.setDemoMatchAnalytics(null);
    supabaseState.setDemoIngestion(null);

    const result = await callGetMatchDetails();

    expect(result).toHaveProperty("demoAnalytics");
    expect(result.demoAnalytics).toBeNull();
  });

  it("returns merged demoAnalytics when parsed demo exists", async () => {
    setupFinishedMatch();
    supabaseState.setDemoMatchAnalytics({
      id: "dma-1",
      ingestion_id: "ing-1",
      faceit_match_id: "match-1",
      map_name: "de_inferno",
      demo_source_type: "faceit_demo_url",
      total_rounds: 20,
      winner_team_key: "team1",
      team1_name: "Alpha",
      team2_name: "Bravo",
      team1_score: 13,
      team2_score: 7,
      team1_first_half_side: "CT",
      team2_first_half_side: "T",
      longest_team1_win_streak: 5,
      longest_team2_win_streak: 3,
      ingestion_status: "parsed",
      parsed_at: "2026-03-25T10:00:00Z",
    });
    supabaseState.setDemoTeamAnalytics([
      {
        team_key: "team1",
        name: "Alpha",
        first_half_side: "CT",
        rounds_won: 13,
        rounds_lost: 7,
        trade_rate: 0.45,
        opening_duel_win_rate: 0.6,
        longest_win_streak: 5,
        longest_loss_streak: 2,
      },
      {
        team_key: "team2",
        name: "Bravo",
        first_half_side: "T",
        rounds_won: 7,
        rounds_lost: 13,
        trade_rate: 0.3,
        opening_duel_win_rate: 0.4,
        longest_win_streak: 3,
        longest_loss_streak: 4,
      },
    ]);
    supabaseState.setDemoPlayerAnalytics([
      {
        faceit_player_id: "p1",
        nickname: "Player1",
        team_key: "team1",
        kills: 25,
        deaths: 12,
        assists: 5,
        adr_demo: 95.5,
        trade_kills: 4,
        untraded_deaths: 3,
        rws: 12.5,
      },
    ]);
    supabaseState.setDemoRoundAnalytics([
      {
        round_number: 1,
        winner_team_key: "team1",
        score_team1: 1,
        score_team2: 0,
        t_team_key: "team2",
        ct_team_key: "team1",
        is_pistol: true,
        bomb_planted: false,
        bomb_defused: false,
      },
    ]);

    const result = await callGetMatchDetails();

    expect(result.demoAnalytics).not.toBeNull();
    expect(result.demoAnalytics).toMatchObject({
      matchId: "match-1",
      sourceType: "faceit_demo_url",
      ingestionStatus: "parsed",
      mapName: "de_inferno",
      totalRounds: 20,
    });
    expect(result.demoAnalytics!.teams).toHaveLength(2);
    expect(result.demoAnalytics!.teams[0]).toMatchObject({
      teamKey: "team1",
      name: "Alpha",
      side: "CT",
      roundsWon: 13,
      roundsLost: 7,
    });
    expect(result.demoAnalytics!.players).toHaveLength(1);
    expect(result.demoAnalytics!.players[0]).toMatchObject({
      playerId: "p1",
      nickname: "Player1",
      teamKey: "team1",
      tradeKills: 4,
      untradedDeaths: 3,
      rws: 12.5,
    });
    expect(result.demoAnalytics!.rounds).toHaveLength(1);
    expect(result.demoAnalytics!.rounds[0]).toMatchObject({
      roundNumber: 1,
      winnerTeamKey: "team1",
      isPistolRound: true,
    });
  });

  it("returns ingestion status when demo is queued but not yet parsed", async () => {
    setupFinishedMatch();
    supabaseState.setDemoMatchAnalytics(null);
    supabaseState.setDemoIngestion({
      id: "ing-1",
      faceit_match_id: "match-1",
      status: "parsing",
      source_type: "faceit_demo_url",
    });

    const result = await callGetMatchDetails();

    // When match analytics don't exist but an ingestion does, demoAnalytics
    // should reflect the in-progress ingestion status
    expect(result.demoAnalytics).not.toBeNull();
    expect(result.demoAnalytics).toMatchObject({
      matchId: "match-1",
      ingestionStatus: "parsing",
      sourceType: "faceit_demo_url",
    });
  });

  it("preserves baseline FACEIT fields alongside demo analytics", async () => {
    setupFinishedMatch();
    supabaseState.setDemoMatchAnalytics({
      id: "dma-1",
      ingestion_id: "ing-1",
      faceit_match_id: "match-1",
      map_name: "de_inferno",
      demo_source_type: "faceit_demo_url",
      total_rounds: 20,
      winner_team_key: "team1",
      team1_name: "Alpha",
      team2_name: "Bravo",
      team1_score: 13,
      team2_score: 7,
      team1_first_half_side: "CT",
      team2_first_half_side: "T",
      longest_team1_win_streak: 5,
      longest_team2_win_streak: 3,
      ingestion_status: "parsed",
      parsed_at: "2026-03-25T10:00:00Z",
    });

    const result = await callGetMatchDetails();

    // FACEIT baseline fields must still be present
    expect(result.matchId).toBe("match-1");
    expect(result.map).toBe("de_inferno");
    expect(result.status).toBe("FINISHED");
    expect(result.demoUrl).toBe("https://demo.test/demo.dem.zst");
    expect(result.players).toHaveLength(2);
    // Demo analytics present too
    expect(result.demoAnalytics).not.toBeNull();
  });
});
