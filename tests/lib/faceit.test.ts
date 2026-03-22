import { describe, it, expect } from "vitest";
import {
  buildMatchScoreString,
  pickRelevantHistoryMatch,
  parseMatchStats,
  parseMatchTeamScore,
  parseLifetimeStats,
  parsePlayerProfile,
} from "~/lib/faceit";

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
});

describe("parseMatchTeamScore", () => {
  it("falls back to current score fields used by live FACEIT stats payloads", () => {
    expect(parseMatchTeamScore({ "Current Score": "9" })).toBe(9);
    expect(parseMatchTeamScore({ Score: "7" })).toBe(7);
    expect(parseMatchTeamScore({ "Final Score": "13" })).toBe(13);
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
});
