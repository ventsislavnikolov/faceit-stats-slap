import { describe, it, expect } from "vitest";
import { parsePlayerProfile, parseLifetimeStats, parseMatchStats } from "~/lib/faceit";

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
