import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMatchStats,
  fetchPlayer,
  fetchPlayerHistory,
  parseMatchStats,
} from "~/lib/faceit";
import { getPartySessionStats } from "~/server/matches";
import { runWithStartContext } from "../start-context";

const faceitMocks = vi.hoisted(() => ({
  fetchPlayer: vi.fn(),
  fetchPlayerHistory: vi.fn(),
  fetchMatchStats: vi.fn(),
  parseMatchStats: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    if (table === "demo_match_analytics") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: "PGRST116", message: "not found" },
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
                  data: null,
                  error: { code: "PGRST116", message: "not found" },
                })),
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }),
}));

vi.mock("~/lib/faceit", async () => {
  const actual =
    await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
  return {
    ...actual,
    fetchPlayer: faceitMocks.fetchPlayer,
    fetchPlayerHistory: faceitMocks.fetchPlayerHistory,
    fetchMatchStats: faceitMocks.fetchMatchStats,
    parseMatchStats: faceitMocks.parseMatchStats,
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => ({ from: supabaseMocks.from }),
}));

afterEach(() => {
  vi.resetAllMocks();
});

function buildRawPlayer(
  player_id: string,
  nickname: string,
  kills: number,
  result: boolean
) {
  return {
    player_id,
    nickname,
    kills,
    deaths: 10,
    assists: 4,
    headshots: 6,
    mvps: 1,
    kd_ratio: kills / 10,
    adr: kills * 4,
    hs_percent: 40,
    kr_ratio: 0.7,
    triple_kills: 0,
    quadro_kills: 0,
    penta_kills: 0,
    result,
    damage: kills * 100,
    first_kills: 1,
    entry_count: 2,
    entry_wins: result ? 2 : 0,
    clutch_kills: 0,
    one_v1_count: 0,
    one_v1_wins: 0,
    one_v2_count: 0,
    one_v2_wins: 0,
    double_kills: 0,
    utility_damage: 50,
    enemies_flashed: 3,
    flash_count: 5,
    sniper_kills: 0,
    pistol_kills: 1,
  };
}

describe("getPartySessionStats", () => {
  it("includes rivalry data built from the session aggregates", async () => {
    vi.mocked(fetchPlayer).mockResolvedValue({
      faceitId: "player-1",
      nickname: "Alice",
      avatar: "",
      elo: 2000,
      skillLevel: 10,
      country: "BG",
      friendsIds: ["friend-1", "friend-2"],
    });

    vi.mocked(fetchPlayerHistory).mockResolvedValue([
      {
        match_id: "match-1",
        started_at: 1_774_402_000,
        finished_at: 1_774_405_600,
      },
      {
        match_id: "match-2",
        started_at: 1_774_410_000,
        finished_at: 1_774_413_600,
      },
    ]);

    vi.mocked(parseMatchStats).mockImplementation((raw: any) => ({
      playerId: raw.player_id,
      nickname: raw.nickname,
      kills: raw.kills,
      deaths: raw.deaths,
      assists: raw.assists,
      headshots: raw.headshots,
      mvps: raw.mvps,
      kdRatio: raw.kd_ratio,
      adr: raw.adr,
      hsPercent: raw.hs_percent,
      krRatio: raw.kr_ratio,
      tripleKills: raw.triple_kills,
      quadroKills: raw.quadro_kills,
      pentaKills: raw.penta_kills,
      result: raw.result,
      damage: raw.damage,
      firstKills: raw.first_kills,
      entryCount: raw.entry_count,
      entryWins: raw.entry_wins,
      clutchKills: raw.clutch_kills,
      oneV1Count: raw.one_v1_count,
      oneV1Wins: raw.one_v1_wins,
      oneV2Count: raw.one_v2_count,
      oneV2Wins: raw.one_v2_wins,
      doubleKills: raw.double_kills,
      utilityDamage: raw.utility_damage,
      enemiesFlashed: raw.enemies_flashed,
      flashCount: raw.flash_count,
      sniperKills: raw.sniper_kills,
      pistolKills: raw.pistol_kills,
    }));

    vi.mocked(fetchMatchStats).mockResolvedValueOnce({
      rounds: [
        {
          round_stats: { Map: "de_inferno", Score: "13-11" },
          teams: [
            {
              players: [
                buildRawPlayer("player-1", "Alice", 25, true),
                buildRawPlayer("friend-1", "Bob", 21, true),
                buildRawPlayer("friend-2", "Cara", 19, true),
              ],
            },
            {
              players: [
                buildRawPlayer("enemy-1", "Enemy 1", 16, false),
                buildRawPlayer("enemy-2", "Enemy 2", 15, false),
                buildRawPlayer("enemy-3", "Enemy 3", 14, false),
              ],
            },
          ],
        },
      ],
    } as any);

    vi.mocked(fetchMatchStats).mockResolvedValueOnce({
      rounds: [
        {
          round_stats: { Map: "de_mirage", Score: "13-9" },
          teams: [
            {
              players: [
                buildRawPlayer("player-1", "Alice", 18, true),
                buildRawPlayer("friend-1", "Bob", 14, true),
                buildRawPlayer("friend-2", "Cara", 12, true),
              ],
            },
            {
              players: [
                buildRawPlayer("enemy-1", "Enemy 1", 24, false),
                buildRawPlayer("enemy-2", "Enemy 2", 20, false),
                buildRawPlayer("enemy-3", "Enemy 3", 19, false),
              ],
            },
          ],
        },
      ],
    } as any);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        getPartySessionStats({
          data: { playerId: "player-1", date: "2026-03-25" },
        } as any)
    );

    expect(result.rivalries).toBeDefined();
    expect(result.rivalries?.podium[0]?.nickname).toBe("Alice");
    expect(result.rivalries?.podium).toHaveLength(3);
    expect(result.rivalries?.rivalryCards.length).toBeGreaterThan(0);
  });
});
