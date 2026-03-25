import { describe, expect, it } from "vitest";
import {
  aggregatePlayerDemoSummary,
  type DemoPlayerSummary,
  type DemoPlayerRow,
} from "~/server/demo-player-summaries";

function buildRow(overrides: Partial<DemoPlayerRow> = {}): DemoPlayerRow {
  return {
    faceit_player_id: "p1",
    nickname: "Alice",
    kills: 20,
    deaths: 15,
    assists: 5,
    adr_demo: 85,
    hs_percent_demo: 45,
    entry_kills: 2,
    entry_deaths: 1,
    opening_duel_attempts: 3,
    opening_duel_wins: 2,
    trade_kills: 3,
    traded_deaths: 1,
    untraded_deaths: 4,
    exit_kills: 1,
    clutch_attempts: 2,
    clutch_wins: 1,
    last_alive_rounds: 3,
    bomb_plants: 1,
    bomb_defuses: 0,
    utility_damage_demo: 80,
    flash_assists_demo: 4,
    rws: 12.5,
    ...overrides,
  };
}

describe("aggregatePlayerDemoSummary", () => {
  it("returns null for empty rows", () => {
    const result = aggregatePlayerDemoSummary([]);
    expect(result).toBeNull();
  });

  it("returns correct summary for a single match (sample of 1)", () => {
    const rows = [buildRow()];
    const result = aggregatePlayerDemoSummary(rows)!;

    expect(result.sampleMatchCount).toBe(1);
    expect(result.playerId).toBe("p1");
    expect(result.nickname).toBe("Alice");

    // Single match — averages equal the single values
    expect(result.avgKills).toBe(20);
    expect(result.avgDeaths).toBe(15);
    expect(result.avgAssists).toBe(5);
    expect(result.avgAdr).toBe(85);
    expect(result.avgHsPercent).toBe(45);
    expect(result.avgRws).toBe(12.5);

    // Totals
    expect(result.totalTradeKills).toBe(3);
    expect(result.totalUntradedDeaths).toBe(4);
    expect(result.totalEntryKills).toBe(2);
    expect(result.totalClutchAttempts).toBe(2);
    expect(result.totalClutchWins).toBe(1);
    expect(result.totalBombPlants).toBe(1);
    expect(result.totalBombDefuses).toBe(0);
  });

  it("returns correct averages and totals for a sample of 5", () => {
    const rows = [
      buildRow({ kills: 20, deaths: 10, adr_demo: 90, rws: 15 }),
      buildRow({ kills: 15, deaths: 18, adr_demo: 70, rws: 8 }),
      buildRow({ kills: 22, deaths: 12, adr_demo: 95, rws: 16 }),
      buildRow({ kills: 18, deaths: 14, adr_demo: 82, rws: 11 }),
      buildRow({ kills: 25, deaths: 9, adr_demo: 100, rws: 18 }),
    ];
    const result = aggregatePlayerDemoSummary(rows)!;

    expect(result.sampleMatchCount).toBe(5);
    expect(result.avgKills).toBe(20); // (20+15+22+18+25)/5
    expect(result.avgDeaths).toBeCloseTo(12.6, 1); // (10+18+12+14+9)/5
    expect(result.avgAdr).toBeCloseTo(87.4, 1); // (90+70+95+82+100)/5
    expect(result.avgRws).toBeCloseTo(13.6, 1); // (15+8+16+11+18)/5

    // Totals are summed across all matches
    expect(result.totalTradeKills).toBe(15); // 3*5
    expect(result.totalUntradedDeaths).toBe(20); // 4*5
    expect(result.totalEntryKills).toBe(10); // 2*5
  });

  it("uses the most recent nickname", () => {
    const rows = [
      buildRow({ nickname: "OldName" }),
      buildRow({ nickname: "NewName" }),
    ];
    // Last row is most recent
    const result = aggregatePlayerDemoSummary(rows)!;
    expect(result.nickname).toBe("NewName");
  });

  it("computes derived rates correctly", () => {
    const rows = [
      buildRow({
        opening_duel_attempts: 4,
        opening_duel_wins: 2,
        clutch_attempts: 3,
        clutch_wins: 1,
        trade_kills: 5,
        deaths: 20,
        traded_deaths: 8,
      }),
    ];
    const result = aggregatePlayerDemoSummary(rows)!;

    expect(result.openingDuelWinRate).toBeCloseTo(0.5, 2); // 2/4
    expect(result.clutchWinRate).toBeCloseTo(1 / 3, 2); // 1/3
  });
});

// ---------------------------------------------------------------------------
// getPlayerDemoSummary (Supabase query wrapper)
// ---------------------------------------------------------------------------

describe("getPlayerDemoSummary", () => {
  it("queries demo_player_analytics and aggregates results", async () => {
    const { getPlayerDemoSummary } = await import("~/server/demo-player-summaries");

    const mockRows = [buildRow(), buildRow({ kills: 30, rws: 18 })];

    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({ data: mockRows, error: null }),
          }),
        }),
      }),
    };

    const result = await getPlayerDemoSummary(sb as never, "p1");
    expect(result).not.toBeNull();
    expect(result!.sampleMatchCount).toBe(2);
    expect(result!.avgKills).toBe(25); // (20+30)/2
  });

  it("returns null when no rows found", async () => {
    const { getPlayerDemoSummary } = await import("~/server/demo-player-summaries");

    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    };

    const result = await getPlayerDemoSummary(sb as never, "p1");
    expect(result).toBeNull();
  });
});
