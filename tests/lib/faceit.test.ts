import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildMatchScoreString,
  faceitFetch,
  fetchMatch,
  fetchMatchStats,
  fetchPlayer,
  fetchPlayerByNickname,
  fetchPlayerHistory,
  fetchPlayerLifetimeStats,
  pickRelevantHistoryMatch,
  parseMatchStats,
  parseMatchTeamScore,
  parseLifetimeStats,
  parsePlayerProfile,
} from "~/lib/faceit";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("parsePlayerProfile", () => {
  it("extracts player fields from API response", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      avatar: "https://cdn.faceit.com/test.jpg",
      country: "bg",
      games: {
        cs2: { faceit_elo: 1689, skill_level: 8 },
      },
    };
    const result = parsePlayerProfile(raw);
    expect(result).toEqual({
      faceitId: "abc-123",
      nickname: "TestPlayer",
      avatar: "https://cdn.faceit.com/test.jpg",
      elo: 1689,
      skillLevel: 8,
      country: "bg",
    });
  });

  it("handles missing cs2 game data", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      avatar: "",
      country: "us",
      games: {},
    };
    const result = parsePlayerProfile(raw);
    expect(result.elo).toBe(0);
    expect(result.skillLevel).toBe(0);
  });
});

describe("parseLifetimeStats", () => {
  it("extracts lifetime stats from API response", () => {
    const raw = {
      lifetime: {
        "Average K/D Ratio": "1.32",
        "Average Headshots %": "58",
        "ADR": "98",
        "Win Rate %": "54",
        "Matches": "910",
        "Recent Results": ["1", "1", "0", "1", "0"],
      },
    };
    const result = parseLifetimeStats(raw);
    expect(result.lifetimeKd).toBe(1.32);
    expect(result.lifetimeHs).toBe(58);
    expect(result.lifetimeAdr).toBe(98);
    expect(result.winRate).toBe(54);
    expect(result.totalMatches).toBe(910);
    expect(result.recentResults).toEqual([true, true, false, true, false]);
  });

  it("falls back to zero values when lifetime fields are missing", () => {
    expect(parseLifetimeStats({})).toEqual({
      lifetimeKd: 0,
      lifetimeHs: 0,
      lifetimeAdr: 0,
      winRate: 0,
      totalMatches: 0,
      recentResults: [],
    });
  });
});

describe("parseMatchStats", () => {
  it("extracts per-player stats from match stats response", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      player_stats: {
        Kills: "18",
        Deaths: "8",
        Assists: "4",
        Headshots: "10",
        MVPs: "3",
        "K/D Ratio": "2.25",
        ADR: "112.3",
        "Headshots %": "55",
        "Triple Kills": "2",
        "Quadro Kills": "1",
        "Penta Kills": "0",
        Result: "1",
      },
    };
    const result = parseMatchStats(raw);
    expect(result.kills).toBe(18);
    expect(result.deaths).toBe(8);
    expect(result.kdRatio).toBe(2.25);
    expect(result.adr).toBe(112.3);
    expect(result.result).toBe(true);
  });

  it("falls back to zero values when player stats are missing", () => {
    expect(
      parseMatchStats({
        player_id: "abc-123",
        nickname: "TestPlayer",
      })
    ).toEqual({
      playerId: "abc-123",
      nickname: "TestPlayer",
      kills: 0,
      deaths: 0,
      assists: 0,
      headshots: 0,
      mvps: 0,
      kdRatio: 0,
      adr: 0,
      hsPercent: 0,
      krRatio: 0,
      tripleKills: 0,
      quadroKills: 0,
      pentaKills: 0,
      result: false,
      damage: 0,
      firstKills: 0,
      entryCount: 0,
      entryWins: 0,
      clutchKills: 0,
      oneV1Count: 0,
      oneV1Wins: 0,
      oneV2Count: 0,
      oneV2Wins: 0,
      doubleKills: 0,
      utilityDamage: 0,
      enemiesFlashed: 0,
      flashCount: 0,
      sniperKills: 0,
      pistolKills: 0,
    });
  });
});

describe("parseMatchTeamScore", () => {
  it("falls back to current score fields used by live FACEIT stats payloads", () => {
    expect(parseMatchTeamScore({ "Current Score": "9" })).toBe(9);
    expect(parseMatchTeamScore({ Score: "7" })).toBe(7);
    expect(parseMatchTeamScore({ "Final Score": "13" })).toBe(13);
  });

  it("returns zero when no score fields are present", () => {
    expect(parseMatchTeamScore({})).toBe(0);
    expect(parseMatchTeamScore(undefined)).toBe(0);
  });
});

describe("buildMatchScoreString", () => {
  it("builds a score string from team stats when round stats score is missing", () => {
    const result = buildMatchScoreString(
      {},
      [
        { team_stats: { "Current Score": "9" } },
        { team_stats: { "Current Score": "6" } },
      ]
    );

    expect(result).toBe("9 / 6");
  });

  it("prefers the score already present in round stats", () => {
    const result = buildMatchScoreString(
      { Score: "13 / 10" },
      [
        { team_stats: { "Final Score": "13" } },
        { team_stats: { "Final Score": "10" } },
      ]
    );

    expect(result).toBe("13 / 10");
  });

  it("returns an empty string when no scores are available anywhere", () => {
    expect(buildMatchScoreString({}, [{ team_stats: {} }, { team_stats: {} }])).toBe("");
  });
});

describe("pickRelevantHistoryMatch", () => {
  it("prefers an active match from recent history over a newer finished one", () => {
    const result = pickRelevantHistoryMatch([
      { match_id: "finished-1", status: "FINISHED" },
      { match_id: "ongoing-1", status: "ONGOING" },
    ]);

    expect(result?.match_id).toBe("ongoing-1");
  });

  it("falls back to the most recent history item when there is no active match", () => {
    const result = pickRelevantHistoryMatch([
      { match_id: "finished-1", status: "FINISHED" },
      { match_id: "finished-2", status: "FINISHED" },
    ]);

    expect(result?.match_id).toBe("finished-1");
  });

  it("returns null for empty history", () => {
    expect(pickRelevantHistoryMatch([])).toBeNull();
  });
});

describe("faceitFetch", () => {
  it("retries rate-limited requests before succeeding", async () => {
    vi.useFakeTimers();
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          statusText: "Too Many Requests",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const promise = faceitFetch("/players/test-player");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws immediately for non-retryable responses", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("bad request", {
        status: 400,
        statusText: "Bad Request",
      })
    );

    await expect(faceitFetch("/players/test-player")).rejects.toThrow(
      "FACEIT API error: 400 Bad Request for /players/test-player"
    );
  });

  it("throws after exhausting retry attempts", async () => {
    vi.useFakeTimers();
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );

    const promise = expect(faceitFetch("/players/test-player")).rejects.toThrow(
      "FACEIT API error: 503 Service Unavailable for /players/test-player"
    );
    await vi.runAllTimersAsync();
    await promise;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when the FACEIT api key is missing", async () => {
    delete process.env.FACEIT_SERVER_SIDE_API_KEY;

    await expect(faceitFetch("/players/test-player")).rejects.toThrow(
      "Missing FACEIT_SERVER_SIDE_API_KEY"
    );
  });
});

describe("fetchPlayerHistory", () => {
  it("passes offset through to the history endpoint", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await fetchPlayerHistory("player-123", 25, 75);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/players/player-123/history?game=cs2&offset=75&limit=25"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });
});

describe("FACEIT endpoint helpers", () => {
  it("fetches a player profile and falls back to an empty friends list", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          player_id: "player-123",
          nickname: "SoAvarice",
          country: "BG",
          games: {
            cs2: { faceit_elo: 1690, skill_level: 8 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(fetchPlayer("player-123")).resolves.toEqual({
      faceitId: "player-123",
      nickname: "SoAvarice",
      avatar: "",
      elo: 1690,
      skillLevel: 8,
      country: "BG",
      friendsIds: [],
    });
  });

  it("fetches a player by nickname and preserves returned friends ids", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          player_id: "player-123",
          nickname: "So Avarice",
          country: "BG",
          avatar: "https://avatar.test/player.png",
          friends_ids: ["friend-1"],
          games: {
            cs2: { faceit_elo: 1690, skill_level: 8 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(fetchPlayerByNickname("So Avarice")).resolves.toEqual({
      faceitId: "player-123",
      nickname: "So Avarice",
      avatar: "https://avatar.test/player.png",
      elo: 1690,
      skillLevel: 8,
      country: "BG",
      friendsIds: ["friend-1"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/players?nickname=So%20Avarice&game=cs2"),
      expect.any(Object)
    );
  });

  it("fetches player lifetime stats through the stats endpoint", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          lifetime: {
            "Average K/D Ratio": "1.10",
            "Average Headshots %": "40",
            ADR: "82.5",
            "Win Rate %": "51",
            Matches: "300",
            "Recent Results": ["1", "0"],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(fetchPlayerLifetimeStats("player-123")).resolves.toEqual({
      lifetimeKd: 1.1,
      lifetimeHs: 40,
      lifetimeAdr: 82.5,
      winRate: 51,
      totalMatches: 300,
      recentResults: [true, false],
    });
  });

  it("fetches raw match and match stats payloads", async () => {
    process.env.FACEIT_SERVER_SIDE_API_KEY = "test-key";

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ match_id: "match-1", status: "READY" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rounds: [{ round_stats: { Map: "de_nuke" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(fetchMatch("match-1")).resolves.toEqual({
      match_id: "match-1",
      status: "READY",
    });
    await expect(fetchMatchStats("match-1")).resolves.toEqual({
      rounds: [{ round_stats: { Map: "de_nuke" } }],
    });
  });
});
