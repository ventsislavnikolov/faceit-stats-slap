import { describe, expect, it, vi } from "vitest";
import type { DemoMatchAnalytics } from "~/lib/types";
import {
  markDemoIngestionFailed,
  markDemoIngestionParsed,
  markDemoIngestionParsing,
  saveDemoAnalytics,
  upsertDemoIngestion,
} from "~/server/demo-analytics-store";
import { ingestParsedDemoFile } from "~/server/demo-parser";

/**
 * Supabase mock that tracks every call per table and method.
 * Supports the insert→select→single chain for getting back generated IDs.
 */
function createSupabaseMock(generatedId = "mock-uuid") {
  const calls: Array<{
    table: string;
    method: "insert" | "upsert" | "update";
    rows?: Record<string, unknown>[];
    update?: Record<string, unknown>;
    options?: Record<string, unknown>;
    eqArgs?: [string, unknown];
  }> = [];

  return {
    calls,
    from(table: string) {
      return {
        insert(rows: Record<string, unknown>[]) {
          const entry = { table, method: "insert" as const, rows };
          calls.push(entry);
          const result = { data: null, error: null };
          const promise = Promise.resolve(result) as ReturnType<
            ReturnType<typeof createSupabaseMock>["from"]
          >["insert"] extends (...args: never[]) => infer R
            ? R
            : never;
          (promise as Record<string, unknown>).select = () => ({
            single: async () => ({ data: { id: generatedId }, error: null }),
          });
          return promise;
        },
        upsert(
          rows: Record<string, unknown>[],
          opts?: Record<string, unknown>
        ) {
          calls.push({ table, method: "upsert", rows, options: opts });
          return Promise.resolve({ data: null, error: null });
        },
        update(row: Record<string, unknown>) {
          const entry = {
            table,
            method: "update" as const,
            update: row,
            eqArgs: undefined as [string, unknown] | undefined,
          };
          calls.push(entry);
          return {
            eq: async (column: string, value: unknown) => {
              entry.eqArgs = [column, value];
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };
}

function buildDemoAnalytics(): DemoMatchAnalytics {
  return {
    matchId: "match-123",
    sourceType: "faceit_demo_url",
    availability: "available",
    ingestionStatus: "parsed",
    mapName: "de_inferno",
    totalRounds: 20,
    teams: [
      {
        teamKey: "team1",
        name: "Team Alpha",
        side: "CT",
        roundsWon: 11,
        roundsLost: 9,
        tradeKills: 18,
        untradedDeaths: 7,
        rws: 0.5,
      },
      {
        teamKey: "team2",
        name: "Team Beta",
        side: "T",
        roundsWon: 9,
        roundsLost: 11,
        tradeKills: 15,
        untradedDeaths: 8,
        rws: 0.42,
      },
    ],
    players: Array.from({ length: 10 }, (_, i) => ({
      nickname: `Player ${i + 1}`,
      teamKey: (i < 5 ? "team1" : "team2") as "team1" | "team2",
      tradeKills: i + 1,
      untradedDeaths: 10 - i,
      rws: 1.1 + i / 10,
      playerId: `faceit-${i + 1}`,
      kills: 20 - i,
      deaths: 10 + i,
      assists: 3 + i,
      adr: 80 + i,
      damage: 1500 + i * 25,
    })),
    rounds: Array.from({ length: 20 }, (_, i) => ({
      roundNumber: i + 1,
      winnerTeamKey: (i < 10 ? "team1" : "team2") as "team1" | "team2",
      winnerSide: (i < 10 ? "CT" : "T") as "CT" | "T",
      isPistolRound: i === 0 || i === 15,
      isBombRound: i % 2 === 0,
      scoreAfterRound: {
        team1: i < 10 ? i + 1 : 10,
        team2: i < 10 ? 0 : i - 9,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Ingestion lifecycle
// ---------------------------------------------------------------------------

describe("upsertDemoIngestion", () => {
  it("inserts with faceit_match_id (not match_id) and returns the generated id", async () => {
    const sb = createSupabaseMock("ingestion-uuid-1");

    const result = await upsertDemoIngestion(sb as never, {
      faceitMatchId: "match-123",
      sourceType: "faceit_demo_url",
      sourceUrl: "https://faceit.example/demo",
      fileName: "match.dem.zst",
      fileSizeBytes: 12_345,
      fileSha256: "sha-123",
      compression: "zst",
      parserVersion: "demo-parser@1",
      demoPatchVersion: "v1",
    });

    expect(result).toEqual({ id: "ingestion-uuid-1" });

    const call = sb.calls.find((c) => c.table === "demo_ingestions");
    expect(call).toBeDefined();
    const row = call!.rows![0];
    expect(row).toMatchObject({
      faceit_match_id: "match-123",
      source_type: "faceit_demo_url",
      source_url: "https://faceit.example/demo",
      file_name: "match.dem.zst",
      file_size_bytes: 12_345,
      file_sha256: "sha-123",
      compression: "zst",
      status: "queued",
      parser_version: "demo-parser@1",
      demo_patch_version: "v1",
    });
    expect(row).not.toHaveProperty("match_id");
  });
});

describe("markDemoIngestionParsing", () => {
  it("updates status to parsing by ingestion id", async () => {
    const sb = createSupabaseMock();
    await markDemoIngestionParsing(
      sb as never,
      "ing-1",
      "2026-03-25T10:00:00Z"
    );

    const call = sb.calls.find(
      (c) => c.table === "demo_ingestions" && c.method === "update"
    );
    expect(call!.update).toMatchObject({
      status: "parsing",
      started_at: "2026-03-25T10:00:00Z",
    });
    expect(call!.eqArgs).toEqual(["id", "ing-1"]);
  });
});

describe("markDemoIngestionFailed", () => {
  it("updates status to failed with error message by ingestion id", async () => {
    const sb = createSupabaseMock();
    await markDemoIngestionFailed(
      sb as never,
      "ing-1",
      "parser exploded",
      "2026-03-25T10:05:00Z"
    );

    const call = sb.calls.find(
      (c) => c.table === "demo_ingestions" && c.method === "update"
    );
    expect(call!.update).toMatchObject({
      status: "failed",
      error_message: "parser exploded",
      finished_at: "2026-03-25T10:05:00Z",
    });
    expect(call!.eqArgs).toEqual(["id", "ing-1"]);
  });
});

describe("markDemoIngestionParsed", () => {
  it("updates status to parsed by ingestion id", async () => {
    const sb = createSupabaseMock();
    await markDemoIngestionParsed(sb as never, "ing-1", "2026-03-25T10:10:00Z");

    const call = sb.calls.find(
      (c) => c.table === "demo_ingestions" && c.method === "update"
    );
    expect(call!.update).toMatchObject({
      status: "parsed",
      finished_at: "2026-03-25T10:10:00Z",
    });
    expect(call!.eqArgs).toEqual(["id", "ing-1"]);
  });
});

// ---------------------------------------------------------------------------
// saveDemoAnalytics — schema-aligned persistence
// ---------------------------------------------------------------------------

describe("saveDemoAnalytics", () => {
  it("writes match analytics with ingestion_id and all NOT NULL columns from schema", async () => {
    const sb = createSupabaseMock("demo-match-uuid");
    await saveDemoAnalytics(sb as never, "ing-1", buildDemoAnalytics());

    const call = sb.calls.find(
      (c) => c.table === "demo_match_analytics" && c.method === "insert"
    );
    expect(call).toBeDefined();
    const row = call!.rows![0];
    expect(row).toMatchObject({
      ingestion_id: "ing-1",
      faceit_match_id: "match-123",
      map_name: "de_inferno",
      demo_source_type: "faceit_demo_url",
      total_rounds: 20,
      team1_name: "Team Alpha",
      team2_name: "Team Beta",
      team1_score: 11,
      team2_score: 9,
      team1_first_half_side: "CT",
      team2_first_half_side: "T",
      ingestion_status: "parsed",
      winner_team_key: "team1",
    });
    // Column that doesn't exist in the migration
    expect(row).not.toHaveProperty("availability");
  });

  it("upserts exactly 2 team rows with demo_match_id and schema columns", async () => {
    const sb = createSupabaseMock("demo-match-uuid");
    await saveDemoAnalytics(sb as never, "ing-1", buildDemoAnalytics());

    const call = sb.calls.find((c) => c.table === "demo_team_analytics");
    expect(call).toBeDefined();
    expect(call!.rows).toHaveLength(2);

    const team1 = call!.rows![0];
    expect(team1).toMatchObject({
      demo_match_id: "demo-match-uuid",
      faceit_match_id: "match-123",
      team_key: "team1",
      name: "Team Alpha",
      first_half_side: "CT",
      rounds_won: 11,
      rounds_lost: 9,
      trade_rate: expect.any(Number),
      opening_duel_win_rate: expect.any(Number),
      longest_win_streak: expect.any(Number),
      longest_loss_streak: expect.any(Number),
    });
    // Columns that don't exist in the migration
    expect(team1).not.toHaveProperty("side");
    expect(team1).not.toHaveProperty("trade_kills");
    expect(team1).not.toHaveProperty("untraded_deaths");
    expect(team1).not.toHaveProperty("rws");
  });

  it("inserts exactly 10 player rows with demo_match_id and NOT NULL defaults", async () => {
    const sb = createSupabaseMock("demo-match-uuid");
    await saveDemoAnalytics(sb as never, "ing-1", buildDemoAnalytics());

    const call = sb.calls.find(
      (c) => c.table === "demo_player_analytics" && c.method === "insert"
    );
    expect(call).toBeDefined();
    expect(call!.rows).toHaveLength(10);

    const p = call!.rows![0];
    expect(p).toMatchObject({
      demo_match_id: "demo-match-uuid",
      faceit_match_id: "match-123",
      faceit_player_id: "faceit-1",
      nickname: "Player 1",
      team_key: "team1",
      kills: 20,
      deaths: 10,
      assists: 3,
      adr_demo: 80,
      hs_percent_demo: 0,
      entry_kills: 0,
      entry_deaths: 0,
      opening_duel_attempts: 0,
      opening_duel_wins: 0,
      trade_kills: 1,
      traded_deaths: 0,
      untraded_deaths: 10,
      exit_kills: 0,
      clutch_attempts: 0,
      clutch_wins: 0,
      last_alive_rounds: 0,
      bomb_plants: 0,
      bomb_defuses: 0,
      utility_damage_demo: 0,
      flash_assists_demo: 0,
      rws: expect.any(Number),
    });
    // Columns that don't exist in the migration
    expect(p).not.toHaveProperty("sample_match_count");
    expect(p).not.toHaveProperty("damage");
  });

  it("inserts exactly 20 round rows with demo_match_id, t_team_key, ct_team_key", async () => {
    const sb = createSupabaseMock("demo-match-uuid");
    await saveDemoAnalytics(sb as never, "ing-1", buildDemoAnalytics());

    const call = sb.calls.find(
      (c) => c.table === "demo_round_analytics" && c.method === "insert"
    );
    expect(call).toBeDefined();
    expect(call!.rows).toHaveLength(20);

    const r = call!.rows![0];
    expect(r).toMatchObject({
      demo_match_id: "demo-match-uuid",
      faceit_match_id: "match-123",
      round_number: 1,
      winner_team_key: "team1",
      score_team1: 1,
      score_team2: 0,
      is_pistol: true,
      t_team_key: expect.stringMatching(/^team[12]$/),
      ct_team_key: expect.stringMatching(/^team[12]$/),
      t_buy_type: "unknown",
      ct_buy_type: "unknown",
      bomb_planted: false,
      bomb_defused: false,
    });
    // Columns that don't exist in the migration
    expect(r).not.toHaveProperty("winner_side");
    expect(r).not.toHaveProperty("is_bomb_round");
  });

  it("throws on supabase error during match insert", async () => {
    const sb = {
      from: () => ({
        insert: () => {
          const p = Promise.resolve({ data: null, error: null });
          (p as Record<string, unknown>).select = () => ({
            single: async () => ({
              data: null,
              error: { message: "unique violation", code: "23505" },
            }),
          });
          return p;
        },
        upsert: async () => ({ data: null, error: null }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      }),
    };

    await expect(
      saveDemoAnalytics(sb as never, "ing-1", buildDemoAnalytics())
    ).rejects.toThrow(/match insert failed/);
  });
});

// ---------------------------------------------------------------------------
// Parser → store handoff (ingestParsedDemoFile)
// ---------------------------------------------------------------------------

describe("ingestParsedDemoFile handoff", () => {
  it("calls store lifecycle in order: upsert → parsing → saveDemoAnalytics → parsed", async () => {
    const order: string[] = [];
    const store = {
      upsertDemoIngestion: vi.fn(async () => {
        order.push("upsertDemoIngestion");
        return { id: "ing-1" };
      }),
      markDemoIngestionParsing: vi.fn(async () => {
        order.push("markDemoIngestionParsing");
      }),
      markDemoIngestionFailed: vi.fn(async () => {
        order.push("markDemoIngestionFailed");
      }),
      markDemoIngestionParsed: vi.fn(async () => {
        order.push("markDemoIngestionParsed");
      }),
      saveDemoAnalytics: vi.fn(async () => {
        order.push("saveDemoAnalytics");
        return { demoMatchId: "dm-1" };
      }),
    };

    await ingestParsedDemoFile("/tmp/demo.dem", {
      matchId: "match-123",
      sourceType: "manual_upload",
      fileSha256: "sha-1",
      store,
      parseDemoFile: async () => ({
        header: { mapName: "de_inferno" },
        playerInfo: { players: [] },
        rounds: [],
        kills: [],
        hurts: [],
        bombEvents: [],
        weaponFires: [],
        blinds: [],
        roundTimings: [],
      }),
    });

    expect(order).toEqual([
      "upsertDemoIngestion",
      "markDemoIngestionParsing",
      "saveDemoAnalytics",
      "markDemoIngestionParsed",
    ]);
  });

  it("marks ingestion as failed when parser throws, skips saveDemoAnalytics", async () => {
    const order: string[] = [];
    const store = {
      upsertDemoIngestion: vi.fn(async () => {
        order.push("upsertDemoIngestion");
        return { id: "ing-1" };
      }),
      markDemoIngestionParsing: vi.fn(async () => {
        order.push("markDemoIngestionParsing");
      }),
      markDemoIngestionFailed: vi.fn(async () => {
        order.push("markDemoIngestionFailed");
      }),
      markDemoIngestionParsed: vi.fn(async () => {
        order.push("markDemoIngestionParsed");
      }),
      saveDemoAnalytics: vi.fn(async () => {
        order.push("saveDemoAnalytics");
        return { demoMatchId: "dm-1" };
      }),
    };

    await expect(
      ingestParsedDemoFile("/tmp/demo.dem", {
        matchId: "match-123",
        sourceType: "manual_upload",
        fileSha256: "sha-1",
        store,
        parseDemoFile: async () => {
          throw new Error("parse failed");
        },
      })
    ).rejects.toThrow("parse failed");

    expect(order).toEqual([
      "upsertDemoIngestion",
      "markDemoIngestionParsing",
      "markDemoIngestionFailed",
    ]);
    expect(store.saveDemoAnalytics).not.toHaveBeenCalled();
    expect(store.markDemoIngestionParsed).not.toHaveBeenCalled();

    expect(store.markDemoIngestionFailed).toHaveBeenCalledWith(
      "ing-1",
      "parse failed",
      expect.any(String)
    );
  });
});
