import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import {
  fetchPlayerHistoryWindow,
  getLiveMatches,
  getMatchDetails,
  getPlayerStats,
  syncAllPlayerHistory,
} from "~/server/matches";

const faceitMocks = vi.hoisted(() => ({
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
  const bettingPoolIgnore = vi.fn(async () => ({ data: null, error: null }));
  const bettingPoolInsert = vi.fn(() => ({
    onConflict: vi.fn(() => ({
      ignore: bettingPoolIgnore,
    })),
  }));
  const rpc = vi.fn(async () => ({ data: null, error: null }));

  let stalePools: Array<{ faceit_match_id: string }> = [];
  let matchRow: { id: string } | null = { id: "db-match-1" };

  const matchesSelectEq = vi.fn(() => ({
    single: vi.fn(async () => ({ data: matchRow })),
  }));
  const matchesSelectIn = vi.fn(async () => ({ data: [] }));

  const matchesSelect = vi.fn(() => ({
    eq: matchesSelectEq,
    in: matchesSelectIn,
  }));

  const bettingPoolsSelectIn = vi.fn(async () => ({ data: stalePools }));
  const bettingPoolsSelect = vi.fn(() => ({
    in: bettingPoolsSelectIn,
  }));

  const from = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        upsert: matchesUpsert,
        select: matchesSelect,
      };
    }

    if (table === "match_player_stats") {
      return {
        upsert: matchPlayerStatsUpsert,
      };
    }

    if (table === "betting_pools") {
      return {
        insert: bettingPoolInsert,
        select: bettingPoolsSelect,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    createSupabase() {
      return {
        from,
      rpc,
    };
  },
    matchesSelectIn,
    matchesUpsert,
    matchPlayerStatsUpsert,
    bettingPoolInsert,
    bettingPoolIgnore,
    bettingPoolsSelectIn,
    rpc,
    setStalePools(value: Array<{ faceit_match_id: string }>) {
      stalePools = value;
    },
    setMatchRow(value: { id: string } | null) {
      matchRow = value;
    },
    reset() {
      stalePools = [];
      matchRow = { id: "db-match-1" };
      matchesUpsert.mockClear();
      matchPlayerStatsUpsert.mockClear();
      bettingPoolInsert.mockClear();
      bettingPoolIgnore.mockClear();
      bettingPoolsSelectIn.mockClear();
      rpc.mockClear();
      matchesSelect.mockClear();
      matchesSelectEq.mockClear();
      matchesSelectIn.mockClear();
      from.mockClear();
    },
  };
});

vi.mock("~/lib/faceit", async () => {
  const actual = await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
  return {
    ...actual,
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

function buildParsedPlayer(playerId: string, nickname: string, kills = 20) {
  return {
    playerId,
    nickname,
    kills,
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
    doubleKills: 3,
    utilityDamage: 120,
    enemiesFlashed: 4,
    flashCount: 5,
    sniperKills: 0,
    pistolKills: 1,
  };
}

beforeEach(() => {
  supabaseState.reset();
  for (const mock of Object.values(faceitMocks)) {
    mock.mockReset();
  }
  webhookMocks.getWebhookLiveMatchMap.mockReset();
  webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchPlayerHistoryWindow", () => {
  it("paginates until the last page and filters out matches older than the cutoff", async () => {
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));
    faceitMocks.fetchPlayerHistory
      .mockResolvedValueOnce([
        { match_id: "recent-1", finished_at: 1774000000 },
        { match_id: "recent-1b", finished_at: 1773800000 },
      ])
      .mockResolvedValueOnce([
        { match_id: "recent-2", started_at: 1773900000 },
      ]);

    const result = await fetchPlayerHistoryWindow("target", 30, 2);

    expect(faceitMocks.fetchPlayerHistory).toHaveBeenNthCalledWith(1, "target", 2, 0);
    expect(faceitMocks.fetchPlayerHistory).toHaveBeenNthCalledWith(2, "target", 2, 2);
    expect(result).toEqual([
      { match_id: "recent-1", finished_at: 1774000000 },
      { match_id: "recent-1b", finished_at: 1773800000 },
      { match_id: "recent-2", started_at: 1773900000 },
    ]);
  });

  it("stops when the oldest item has no usable timestamp", async () => {
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));
    faceitMocks.fetchPlayerHistory.mockResolvedValueOnce([
      { match_id: "recent-1", finished_at: 1774000000 },
      { match_id: "no-time" },
    ]);

    const result = await fetchPlayerHistoryWindow("target", 30, 2);

    expect(faceitMocks.fetchPlayerHistory).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ match_id: "recent-1", finished_at: 1774000000 }]);
  });
});

describe("getMatchDetails", () => {
  it("returns finished match details and persists the parsed stats", async () => {
    faceitMocks.fetchMatch.mockResolvedValue({
      match_id: "match-1",
      status: "FINISHED",
      started_at: 1710000000,
      finished_at: 1710000900,
      demo_url: ["https://demo.test/demo"],
      teams: {
        faction1: { name: "Alpha" },
        faction2: { name: "Bravo" },
      },
      voting: {
        map: { pick: ["de_mirage"] },
      },
      region: "EU",
      competition_name: "Ranked",
    });
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          round_stats: {
            Map: "de_mirage",
            Score: "13 / 9",
            Rounds: "22",
            Region: "EU",
          },
          teams: [
            {
              team_stats: { Team: "Alpha" },
              players: [{ player_id: "p1" }],
            },
            {
              team_stats: { Team: "Bravo" },
              players: [{ player_id: "p2" }],
            },
          ],
        },
      ],
    });
    faceitMocks.parseMatchStats
      .mockReturnValueOnce(buildParsedPlayer("p1", "Player One", 24))
      .mockReturnValueOnce(buildParsedPlayer("p2", "Player Two", 19));
    faceitMocks.parseMatchTeamScore
      .mockReturnValueOnce(13)
      .mockReturnValueOnce(9);
    faceitMocks.buildMatchScoreString.mockReturnValue("13 / 9");

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getMatchDetails({ data: "match-1" } as any)
    );

    expect(result).toMatchObject({
      matchId: "match-1",
      map: "de_mirage",
      score: "13 / 9",
      status: "FINISHED",
      rounds: 22,
      region: "EU",
      competitionName: "Ranked",
      demoUrl: "https://demo.test/demo",
      teams: {
        faction1: { name: "Alpha", score: 13, playerIds: ["p1"] },
        faction2: { name: "Bravo", score: 9, playerIds: ["p2"] },
      },
    });
    expect(result.players).toHaveLength(2);
    expect(supabaseState.matchesUpsert).toHaveBeenCalledTimes(1);
    expect(supabaseState.matchPlayerStatsUpsert).toHaveBeenCalledTimes(2);
  });

  it("returns non-finished match details without persisting anything", async () => {
    faceitMocks.fetchMatch.mockResolvedValue({
      match_id: "match-2",
      status: "ONGOING",
      started_at: 1710000000,
      finished_at: null,
      demo_url: [],
      teams: {
        faction1: { name: "Alpha" },
        faction2: { name: "Bravo" },
      },
      voting: {
        map: { pick: ["de_inferno"] },
      },
      region: "EU",
      competition_name: "Ranked",
    });
    faceitMocks.fetchMatchStats.mockRejectedValue(new Error("no stats yet"));
    faceitMocks.buildMatchScoreString.mockReturnValue("");

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getMatchDetails({ data: "match-2" } as any)
    );

    expect(result).toMatchObject({
      matchId: "match-2",
      map: "de_inferno",
      score: "",
      status: "ONGOING",
      players: [],
    });
    expect(supabaseState.matchesUpsert).not.toHaveBeenCalled();
    expect(supabaseState.matchPlayerStatsUpsert).not.toHaveBeenCalled();
  });

  it("skips player stat persistence when the finished match row cannot be loaded", async () => {
    supabaseState.setMatchRow(null);
    faceitMocks.fetchMatch.mockResolvedValue({
      match_id: "match-3",
      status: "FINISHED",
      started_at: 1710000000,
      finished_at: 1710000900,
      demo_url: [],
      teams: {
        faction1: { name: "Alpha" },
        faction2: { name: "Bravo" },
      },
      voting: {},
      region: "",
      competition_name: "",
    });
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          round_stats: {},
          teams: [
            { team_stats: {}, players: [{ player_id: "p1" }] },
            { team_stats: {}, players: [] },
          ],
        },
      ],
    });
    faceitMocks.parseMatchStats.mockReturnValue(buildParsedPlayer("p1", "Player One", 20));
    faceitMocks.parseMatchTeamScore.mockReturnValue(0);
    faceitMocks.buildMatchScoreString.mockReturnValue("");

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getMatchDetails({ data: "match-3" } as any)
    );

    expect(result).toMatchObject({
      map: "unknown",
      score: "",
      teams: {
        faction1: { name: "Alpha", score: 0 },
        faction2: { name: "Bravo", score: 0 },
      },
    });
    expect(supabaseState.matchesUpsert).toHaveBeenCalledTimes(1);
    expect(supabaseState.matchPlayerStatsUpsert).not.toHaveBeenCalled();
  });
});

describe("getPlayerStats", () => {
  it("returns parsed stats for only the requested player matches", async () => {
    vi.useFakeTimers();
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "m1", started_at: 10, finished_at: 20 },
      { match_id: "m2", started_at: 30, finished_at: 40 },
      { match_id: "m3", started_at: 50, finished_at: 60 },
      { match_id: "m4", started_at: 70, finished_at: 80 },
      { match_id: "m5", started_at: 90, finished_at: 100 },
      { match_id: "m6", started_at: 110, finished_at: 120 },
    ]);
    faceitMocks.fetchMatchStats.mockImplementation(async (matchId: string) => {
      if (matchId === "m2") {
        return { rounds: [{}] };
      }

      return {
        rounds: [
          {
            round_stats: {
              Map: `map-${matchId}`,
              Score: `score-${matchId}`,
            },
            teams: [
              {
                players: matchId === "m3" ? [{ player_id: "other" }] : [{ player_id: "target" }],
              },
            ],
          },
        ],
      };
    });
    faceitMocks.parseMatchStats.mockImplementation((player: { player_id: string }) =>
      buildParsedPlayer(player.player_id, `nick-${player.player_id}`, 17)
    );

    const promise = runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getPlayerStats({ data: "target" } as any)
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(faceitMocks.fetchPlayerHistory).toHaveBeenCalledWith("target", 15, 0);
    expect(faceitMocks.fetchMatchStats).toHaveBeenCalledTimes(6);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      matchId: "m1",
      map: "map-m1",
      score: "score-m1",
      playerId: "target",
      kills: 17,
    });
  });

  it("uses fallback map and score values when the player is found in a later team", async () => {
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "m1", started_at: 10, finished_at: 20 },
    ]);
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          teams: [
            {
              players: [{ player_id: "other" }],
            },
            {
              players: [{ player_id: "target" }],
            },
          ],
        },
      ],
    });
    faceitMocks.parseMatchStats.mockReturnValue(buildParsedPlayer("target", "Target", 24));

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getPlayerStats({ data: "target" } as any)
    );

    expect(result).toEqual([
      expect.objectContaining({
        matchId: "m1",
        map: "unknown",
        score: "",
        kills: 24,
      }),
    ]);
  });

  it("drops matches where the requested player is not present in any team", async () => {
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "m1", started_at: 10, finished_at: 20 },
    ]);
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          teams: [
            {
              players: [{ player_id: "other-1" }],
            },
            {
              players: [{ player_id: "other-2" }],
            },
          ],
        },
      ],
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getPlayerStats({ data: "target" } as any)
    );

    expect(result).toEqual([]);
    expect(faceitMocks.parseMatchStats).not.toHaveBeenCalled();
  });

  it("skips teams without player arrays before finding the target", async () => {
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "m1", started_at: 10, finished_at: 20 },
    ]);
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          round_stats: {
            Map: "de_mirage",
            Score: "13 / 7",
          },
          teams: [
            {},
            {
              players: [{ player_id: "target" }],
            },
          ],
        },
      ],
    });
    faceitMocks.parseMatchStats.mockReturnValue(buildParsedPlayer("target", "Target", 19));

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getPlayerStats({ data: "target" } as any)
    );

    expect(result).toEqual([
      expect.objectContaining({
        matchId: "m1",
        map: "de_mirage",
        score: "13 / 7",
        kills: 19,
      }),
    ]);
  });
});

describe("syncAllPlayerHistory", () => {
  it("deduplicates requested player ids and skips persistence when history is empty", async () => {
    faceitMocks.fetchPlayerHistory.mockResolvedValue([]);

    await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        syncAllPlayerHistory({
          data: {
            targetPlayerId: "target",
            playerIds: ["target", "friend-a"],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(faceitMocks.fetchPlayerHistory).toHaveBeenCalledTimes(2);
    expect(faceitMocks.fetchPlayerHistory).toHaveBeenNthCalledWith(1, "target", 50, 0);
    expect(faceitMocks.fetchPlayerHistory).toHaveBeenNthCalledWith(2, "friend-a", 50, 0);
    expect(supabaseState.matchesSelectIn).not.toHaveBeenCalled();
    expect(supabaseState.matchesUpsert).not.toHaveBeenCalled();
    expect(supabaseState.matchPlayerStatsUpsert).not.toHaveBeenCalled();
  });

  it("syncs missing finished matches and persists parsed player stats", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    faceitMocks.fetchPlayerHistory
      .mockResolvedValueOnce([
        {
          match_id: "history-match-1",
          started_at: 1774170000,
          finished_at: 1774170900,
        },
      ])
      .mockResolvedValueOnce([]);
    faceitMocks.fetchMatchStats.mockResolvedValue({
      rounds: [
        {
          round_stats: {
            Map: "de_ancient",
            Score: "13 / 8",
          },
          teams: [
            {
              players: [{ player_id: "p1" }],
            },
            {
              players: [{ player_id: "p2" }],
            },
          ],
        },
      ],
    });
    faceitMocks.parseMatchStats
      .mockReturnValueOnce(buildParsedPlayer("p1", "Player One", 21))
      .mockReturnValueOnce(buildParsedPlayer("p2", "Player Two", 18));

    await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        syncAllPlayerHistory({
          data: {
            targetPlayerId: "target",
            playerIds: [],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(faceitMocks.fetchPlayerHistory).toHaveBeenCalledTimes(1);
    expect(faceitMocks.fetchPlayerHistory).toHaveBeenNthCalledWith(1, "target", 50, 0);
    expect(supabaseState.matchesSelectIn).toHaveBeenCalledWith("faceit_match_id", [
      "history-match-1",
    ]);
    expect(faceitMocks.fetchMatchStats).toHaveBeenCalledWith("history-match-1");
    expect(supabaseState.matchesUpsert).toHaveBeenCalled();
    expect(supabaseState.matchPlayerStatsUpsert).toHaveBeenCalledTimes(2);
  });

  it("skips already-synced history matches", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    faceitMocks.fetchPlayerHistory.mockReset();
    faceitMocks.fetchMatchStats.mockReset();
    faceitMocks.fetchPlayerHistory.mockResolvedValueOnce([
      {
        match_id: "history-match-1",
        started_at: 1774170000,
        finished_at: 1774170900,
      },
    ]);
    supabaseState.matchesSelectIn.mockResolvedValueOnce({
      data: [{ faceit_match_id: "history-match-1" }],
    });

    await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        syncAllPlayerHistory({
          data: {
            targetPlayerId: "target",
            playerIds: [],
            n: 20,
            days: 30,
          },
        } as any)
    );

    expect(supabaseState.matchesSelectIn).toHaveBeenCalledWith("faceit_match_id", [
      "history-match-1",
    ]);
    expect(faceitMocks.fetchMatchStats).not.toHaveBeenCalled();
    expect(supabaseState.matchesUpsert).not.toHaveBeenCalled();
    expect(supabaseState.matchPlayerStatsUpsert).not.toHaveBeenCalled();
  });
});

describe("getLiveMatches", () => {
  it("returns no matches when every fallback history candidate is empty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    faceitMocks.fetchPlayerHistory.mockResolvedValue([]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue(null);
    supabaseState.setStalePools([]);

    const promise = runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1"] } as any)
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([]);
    expect(faceitMocks.fetchMatch).not.toHaveBeenCalled();
    expect(supabaseState.matchesUpsert).not.toHaveBeenCalled();
  });

  it("skips finished fallback matches that do not have a finished timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(
      new Map([["unfinished-finished-match", ["p1"]]])
    );
    faceitMocks.fetchPlayerHistory.mockResolvedValue([]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue(null);
    supabaseState.setStalePools([]);
    faceitMocks.fetchMatch.mockResolvedValue({
      match_id: "unfinished-finished-match",
      status: "FINISHED",
      started_at: Math.floor(Date.now() / 1000) - 500,
      finished_at: null,
      voting: {},
      results: { score: { faction1: 13, faction2: 11 } },
      teams: {
        faction1: {
          faction_id: "f1",
          leader: "Alpha",
          roster: [{ player_id: "p1", nickname: "P1", avatar: "", game_skill_level: 8 }],
        },
        faction2: {
          faction_id: "f2",
          leader: "Bravo",
          roster: [],
        },
      },
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1"] } as any)
    );

    expect(result).toEqual([]);
    expect(supabaseState.matchesUpsert).not.toHaveBeenCalled();
  });

  it("skips old finished matches and sorts active matches by newest start time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(
      new Map([
        ["p1-match", ["p1"]],
        ["p2-match", ["p2"]],
      ])
    );
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "p3-match", status: "UNKNOWN" },
    ]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue({ match_id: "p3-match" });
    supabaseState.setStalePools([]);

    faceitMocks.fetchMatch.mockImplementation(async (matchId: string) => {
      if (matchId === "p1-match") {
        return {
          match_id: "p1-match",
          status: "ONGOING",
          started_at: Math.floor(Date.now() / 1000) - 600,
          finished_at: null,
          voting: { map: { pick: ["de_nuke"] } },
          results: { score: { faction1: 4, faction2: 2 } },
          teams: {
            faction1: {
              faction_id: "a1",
              leader: "Alpha",
              roster: [{ player_id: "p1", nickname: "P1", avatar: "", game_skill_level: 8 }],
            },
            faction2: {
              faction_id: "a2",
              leader: "Bravo",
              roster: [],
            },
          },
        };
      }

      if (matchId === "p2-match") {
        return {
          match_id: "p2-match",
          status: "READY",
          started_at: Math.floor(Date.now() / 1000) - 120,
          finished_at: null,
          voting: { map: { pick: ["de_mirage"] } },
          results: { score: { faction1: 0, faction2: 0 } },
          teams: {
            faction1: {
              faction_id: "b1",
              leader: "Charlie",
              roster: [{ player_id: "p2", nickname: "P2", avatar: "", game_skill_level: 9 }],
            },
            faction2: {
              faction_id: "b2",
              leader: "Delta",
              roster: [],
            },
          },
        };
      }

      if (matchId === "p3-match") {
        return {
          match_id: "p3-match",
          status: "FINISHED",
          started_at: Math.floor(Date.now() / 1000) - 5000,
          finished_at: Math.floor(Date.now() / 1000) - 4000,
          voting: { map: { pick: ["de_inferno"] } },
          results: { score: { faction1: 13, faction2: 5 } },
          teams: {
            faction1: {
              faction_id: "c1",
              leader: "Echo",
              roster: [{ player_id: "p3", nickname: "P3", avatar: "", game_skill_level: 7 }],
            },
            faction2: {
              faction_id: "c2",
              leader: "Foxtrot",
              roster: [],
            },
          },
        };
      }

      throw new Error(`Unexpected match ${matchId}`);
    });

    const promise = runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1", "p2", "p3"] } as any)
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.map((match) => match.matchId)).toEqual(["p2-match", "p1-match"]);
    expect(supabaseState.bettingPoolInsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to webhook friend ids when the fetched roster does not contain them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(
      new Map([["webhook-match", ["p1"]]])
    );
    supabaseState.setStalePools([]);
    faceitMocks.fetchMatch.mockResolvedValue({
      match_id: "webhook-match",
      status: "ONGOING",
      started_at: 0,
      finished_at: null,
      voting: {},
      results: { score: { faction1: 1, faction2: 0 } },
      teams: {
        faction1: {
          faction_id: "f1",
          leader: "Alpha",
          roster: [{ player_id: "someone-else", nickname: "Else", avatar: "", game_skill_level: 4 }],
        },
        faction2: {
          faction_id: "f2",
          leader: "Bravo",
          roster: [],
        },
      },
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1"] } as any)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.friendIds).toEqual(["p1"]);
    expect(supabaseState.bettingPoolInsert).not.toHaveBeenCalled();
  });

  it("merges webhook and fallback history matches, persists them, and manages stale pools", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(
      new Map([["webhook-match", ["p1"]]])
    );
    faceitMocks.fetchPlayerHistory.mockResolvedValue([
      { match_id: "history-match", status: "FINISHED" },
    ]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue({ match_id: "history-match" });
    supabaseState.setStalePools([
      { faceit_match_id: "stale-finished" },
      { faceit_match_id: "stale-cancelled" },
      { faceit_match_id: "webhook-match" },
    ]);

    faceitMocks.fetchMatch.mockImplementation(async (matchId: string) => {
      if (matchId === "webhook-match") {
        return {
          match_id: "webhook-match",
          status: "ONGOING",
          started_at: Math.floor(Date.now() / 1000) - 120,
          finished_at: null,
          voting: { map: { pick: ["de_nuke"] } },
          results: { score: { faction1: 7, faction2: 5 } },
          teams: {
            faction1: {
              faction_id: "f1",
              leader: "Alpha",
              roster: [{ player_id: "p1", nickname: "P1", avatar: "", game_skill_level: 8 }],
            },
            faction2: {
              faction_id: "f2",
              leader: "Bravo",
              roster: [{ player_id: "pX", nickname: "PX", avatar: "", game_skill_level: 7 }],
            },
          },
        };
      }

      if (matchId === "history-match") {
        return {
          match_id: "history-match",
          status: "FINISHED",
          started_at: Math.floor(Date.now() / 1000) - 900,
          finished_at: Math.floor(Date.now() / 1000) - 300,
          voting: { map: { pick: ["de_mirage"] } },
          results: { score: { faction1: 13, faction2: 11 } },
          teams: {
            faction1: {
              faction_id: "f3",
              leader: "Charlie",
              roster: [{ player_id: "p2", nickname: "P2", avatar: "", game_skill_level: 9 }],
            },
            faction2: {
              faction_id: "f4",
              leader: "Delta",
              roster: [{ player_id: "pY", nickname: "PY", avatar: "", game_skill_level: 6 }],
            },
          },
        };
      }

      if (matchId === "stale-finished") {
        return {
          status: "FINISHED",
          results: { score: { faction1: 16, faction2: 12 } },
        };
      }

      if (matchId === "stale-cancelled") {
        return { status: "CANCELLED" };
      }

      throw new Error(`Unexpected match ${matchId}`);
    });

    const promise = runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1", "p2"] } as any)
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      matchId: "webhook-match",
      status: "ONGOING",
      map: "de_nuke",
      friendFaction: "faction1",
      friendIds: ["p1"],
    });
    expect(result[1]).toMatchObject({
      matchId: "history-match",
      status: "FINISHED",
      map: "de_mirage",
      friendIds: ["p2"],
    });
    expect(supabaseState.matchesUpsert).toHaveBeenCalledTimes(2);
    expect(supabaseState.bettingPoolInsert).toHaveBeenCalledTimes(1);
    expect(supabaseState.rpc).toHaveBeenCalledWith("resolve_pool", {
      p_faceit_match_id: "stale-finished",
      p_winning_team: "team1",
    });
    expect(supabaseState.rpc).toHaveBeenCalledWith("cancel_pool", {
      p_faceit_match_id: "stale-cancelled",
    });
  });

  it("ignores stale pool fetch failures and finished matches without scores", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(new Map());
    faceitMocks.fetchPlayerHistory.mockResolvedValue([]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue(null);
    supabaseState.setStalePools([
      { faceit_match_id: "stale-error" },
      { faceit_match_id: "stale-no-score" },
    ]);

    faceitMocks.fetchMatch.mockImplementation(async (matchId: string) => {
      if (matchId === "stale-error") {
        throw new Error("boom");
      }

      if (matchId === "stale-no-score") {
        return {
          status: "FINISHED",
          results: null,
        };
      }

      throw new Error(`Unexpected match ${matchId}`);
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: [] } as any)
    );

    expect(result).toEqual([]);
    expect(supabaseState.rpc).not.toHaveBeenCalled();
  });

  it("treats voting matches as active and resolves stale pools for team2 wins", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    webhookMocks.getWebhookLiveMatchMap.mockResolvedValue(
      new Map([["voting-match", ["p1"]]])
    );
    faceitMocks.fetchPlayerHistory.mockResolvedValue([]);
    faceitMocks.pickRelevantHistoryMatch.mockReturnValue(null);
    supabaseState.setStalePools([{ faceit_match_id: "stale-team2" }]);

    faceitMocks.fetchMatch.mockImplementation(async (matchId: string) => {
      if (matchId === "voting-match") {
        return {
          match_id: "voting-match",
          status: "VOTING",
          started_at: Math.floor(Date.now() / 1000) - 60,
          finished_at: null,
          voting: {},
          results: { score: { faction1: 0, faction2: 0 } },
          teams: {
            faction1: {
              faction_id: "f1",
              leader: "Alpha",
              roster: [{ player_id: "p1", nickname: "P1", avatar: "", game_skill_level: 8 }],
            },
            faction2: {
              faction_id: "f2",
              leader: "Bravo",
              roster: [],
            },
          },
        };
      }

      if (matchId === "stale-team2") {
        return {
          status: "FINISHED",
          results: { score: { faction1: 8, faction2: 13 } },
        };
      }

      throw new Error(`Unexpected match ${matchId}`);
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLiveMatches({ data: ["p1"] } as any)
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchId: "voting-match",
      status: "VOTING",
    });
    expect(supabaseState.rpc).toHaveBeenCalledWith("resolve_pool", {
      p_faceit_match_id: "stale-team2",
      p_winning_team: "team2",
    });
  });
});
