import { describe, expect, it } from "vitest";
import { buildRichDemoAnalytics } from "~/server/demo-analytics-builder";
import type {
  ParsedDemoBlind,
  ParsedDemoBombEvent,
  ParsedDemoFile,
  ParsedDemoGrenadeDetonate,
  ParsedDemoHurt,
  ParsedDemoItemPurchase,
  ParsedDemoKill,
  ParsedDemoPlayer,
  ParsedDemoRound,
  ParsedDemoRoundTiming,
  ParsedDemoWeaponFire,
} from "~/server/demo-parser";

// ---------------------------------------------------------------------------
// Helpers to build synthetic demo data
// ---------------------------------------------------------------------------

function makePlayers(count = 10): ParsedDemoPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    nickname: `Player${i + 1}`,
    steamId: `steam_${i + 1}`,
    teamNumber: i < 5 ? 2 : 3, // 2 = team1, 3 = team2
  }));
}

function makeRound(
  roundNumber: number,
  winner: "CT" | "T" | null = "CT"
): ParsedDemoRound {
  return {
    roundNumber,
    totalRoundsPlayed: roundNumber,
    winner,
    reason: winner === "CT" ? "ct_win_elimination" : "t_win_bomb",
  };
}

function makeKill(
  roundNumber: number,
  attackerSteamId: string,
  victimSteamId: string,
  tick: number,
  overrides: Partial<ParsedDemoKill> = {}
): ParsedDemoKill {
  return {
    roundNumber,
    attackerSteamId,
    attackerName: attackerSteamId,
    victimSteamId,
    victimName: victimSteamId,
    assisterSteamId: null,
    assistedFlash: false,
    headshot: false,
    weapon: "ak47",
    penetrated: false,
    thruSmoke: false,
    attackerBlind: false,
    noscope: false,
    distance: 15,
    tick,
    ...overrides,
  };
}

function makeHurt(
  roundNumber: number,
  attackerSteamId: string,
  victimSteamId: string,
  damage: number,
  tick: number
): ParsedDemoHurt {
  return {
    roundNumber,
    attackerSteamId,
    victimSteamId,
    damage,
    tick,
    weapon: "ak47",
  };
}

function makeRoundTiming(
  roundNumber: number,
  freezeEndTick: number
): ParsedDemoRoundTiming {
  return { roundNumber, freezeEndTick };
}

/**
 * Builds a minimal 3-round match with 10 players.
 *
 * Round 1 (pistol): CT wins, team1 player kills team2 player
 * Round 2: CT wins, team1 player kills team2 player
 * Round 3: T wins, team2 player kills team1 player
 *
 * team1 wins rounds 1+2 (CT side first half), team2 wins round 3.
 */
function buildMinimalMatch(
  overrides: Partial<ParsedDemoFile> = {}
): ParsedDemoFile {
  const players = makePlayers();
  const rounds = [makeRound(1, "CT"), makeRound(2, "CT"), makeRound(3, "T")];
  const roundTimings = [
    makeRoundTiming(1, 1000),
    makeRoundTiming(2, 5000),
    makeRoundTiming(3, 9000),
  ];

  const kills: ParsedDemoKill[] = [
    // Round 1: team1 (steam_1) kills team2 (steam_6)
    makeKill(1, "steam_1", "steam_6", 1200),
    // Round 2: team1 (steam_2) kills team2 (steam_7)
    makeKill(2, "steam_2", "steam_7", 5300),
    // Round 3: team2 (steam_8) kills team1 (steam_3)
    makeKill(3, "steam_8", "steam_3", 9400),
  ];

  const hurts: ParsedDemoHurt[] = [
    makeHurt(1, "steam_1", "steam_6", 100, 1200),
    makeHurt(2, "steam_2", "steam_7", 80, 5300),
    makeHurt(3, "steam_8", "steam_3", 100, 9400),
  ];

  return {
    header: { mapName: "de_dust2" },
    playerInfo: { players },
    rounds,
    roundTimings,
    kills,
    hurts,
    bombEvents: [],
    weaponFires: [],
    blinds: [],
    itemPurchases: [],
    grenadeDetonates: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildRichDemoAnalytics", () => {
  describe("basic output structure", () => {
    it("returns correct matchId, sourceType, and mapName", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.matchId).toBe("match-123");
      expect(result.sourceType).toBe("manual_upload");
      expect(result.mapName).toBe("de_dust2");
      expect(result.availability).toBe("available");
      expect(result.ingestionStatus).toBe("parsed");
    });

    it("returns correct totalRounds", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.totalRounds).toBe(3);
    });

    it("returns two teams", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.teams).toHaveLength(2);
      expect(result.teams.map((t) => t.teamKey)).toEqual(
        expect.arrayContaining(["team1", "team2"])
      );
    });

    it("returns 10 players", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.players).toHaveLength(10);
    });

    it("returns 3 rounds", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.rounds).toHaveLength(3);
    });
  });

  describe("team analytics", () => {
    it("roundsWon across both teams equals totalRounds", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const totalWon = result.teams.reduce((s, t) => s + t.roundsWon, 0);
      expect(totalWon).toBe(result.totalRounds);
    });

    it("each team has a side (CT or T)", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const team of result.teams) {
        expect(["CT", "T"]).toContain(team.side);
      }
    });

    it("teams have opposite sides", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const sides = result.teams.map((t) => t.side).sort();
      expect(sides).toEqual(["CT", "T"]);
    });

    it("tradeKills is at least 0 for each team", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const team of result.teams) {
        expect(team.tradeKills).toBeGreaterThanOrEqual(0);
      }
    });

    it("roundsWon + roundsLost equals totalRounds for each team", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const team of result.teams) {
        expect(team.roundsWon + team.roundsLost).toBe(result.totalRounds);
      }
    });

    it("team rws is at least 0", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const team of result.teams) {
        expect(team.rws).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("player analytics", () => {
    it("all 10 players have a teamKey", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const player of result.players) {
        expect(["team1", "team2"]).toContain(player.teamKey);
      }
    });

    it("5 players per team", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const team1Count = result.players.filter(
        (p) => p.teamKey === "team1"
      ).length;
      const team2Count = result.players.filter(
        (p) => p.teamKey === "team2"
      ).length;
      expect(team1Count).toBe(5);
      expect(team2Count).toBe(5);
    });

    it("kills, deaths, adr, and rws are non-negative for all players", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const player of result.players) {
        expect(player.kills ?? 0).toBeGreaterThanOrEqual(0);
        expect(player.deaths ?? 0).toBeGreaterThanOrEqual(0);
        expect(player.adr ?? 0).toBeGreaterThanOrEqual(0);
        expect(player.rws).toBeGreaterThanOrEqual(0);
      }
    });

    it("player with kills has correct kill count", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.kills).toBe(1);
    });

    it("player with deaths has correct death count", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player6 = result.players.find((p) => p.playerId === "steam_6");
      expect(player6?.deaths).toBe(1);
    });

    it("total kills across all players equals total kills in demo", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const totalKills = result.players.reduce((s, p) => s + (p.kills ?? 0), 0);
      expect(totalKills).toBe(parsed.kills.length);
    });

    it("adr is calculated correctly for a player with damage", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      // steam_1 did 100 damage across 3 rounds
      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.adr).toBeCloseTo(100 / 3, 0);
    });
  });

  describe("round analytics", () => {
    it("each round has a winnerTeamKey or null", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const round of result.rounds) {
        expect(
          round.winnerTeamKey === null ||
            round.winnerTeamKey === "team1" ||
            round.winnerTeamKey === "team2"
        ).toBe(true);
      }
    });

    it("scoreAfterRound increments correctly", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      let prevTeam1 = 0;
      let prevTeam2 = 0;

      for (const round of result.rounds) {
        const newTeam1 = round.scoreAfterRound.team1;
        const newTeam2 = round.scoreAfterRound.team2;

        // Score should only go up by 0 or 1 per round for each team
        expect(newTeam1 - prevTeam1).toBeGreaterThanOrEqual(0);
        expect(newTeam1 - prevTeam1).toBeLessThanOrEqual(1);
        expect(newTeam2 - prevTeam2).toBeGreaterThanOrEqual(0);
        expect(newTeam2 - prevTeam2).toBeLessThanOrEqual(1);

        // Exactly one team gains a point per round (when winner is known)
        if (round.winnerTeamKey) {
          expect(newTeam1 + newTeam2).toBe(prevTeam1 + prevTeam2 + 1);
        }

        prevTeam1 = newTeam1;
        prevTeam2 = newTeam2;
      }
    });

    it("final score adds up to totalRounds", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const lastRound = result.rounds[result.rounds.length - 1];
      const finalTotal =
        lastRound.scoreAfterRound.team1 + lastRound.scoreAfterRound.team2;
      expect(finalTotal).toBe(result.totalRounds);
    });

    it("round 1 is a pistol round", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.rounds[0].isPistolRound).toBe(true);
    });

    it("round 2 is not a pistol round", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.rounds[1].isPistolRound).toBe(false);
    });

    it("each round has a winnerSide (CT, T, or null)", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const round of result.rounds) {
        expect([null, "CT", "T"]).toContain(round.winnerSide);
      }
    });
  });

  describe("trade kills", () => {
    it("detects a trade kill when retaliation happens within trade window", () => {
      const baseTick = 1200;
      // team2 kills team1 player, then team1 retaliates within 5 seconds (320 ticks)
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_6", "steam_1", baseTick),
        makeKill(1, "steam_2", "steam_7", baseTick + 100), // 100 ticks later, within window
      ];

      const hurts: ParsedDemoHurt[] = [
        makeHurt(1, "steam_6", "steam_1", 100, baseTick),
        makeHurt(1, "steam_2", "steam_7", 100, baseTick + 100),
      ];

      const parsed = buildMinimalMatch({ kills, hurts });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player2 = result.players.find((p) => p.playerId === "steam_2");
      expect(player2?.tradeKills).toBeGreaterThan(0);
    });

    it("does not count trade kill when retaliation is outside trade window", () => {
      const baseTick = 1200;
      // 5 * 64 = 320 ticks is the trade window; use 400 ticks (well outside)
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_6", "steam_1", baseTick),
        makeKill(1, "steam_2", "steam_7", baseTick + 400),
      ];

      const hurts: ParsedDemoHurt[] = [
        makeHurt(1, "steam_6", "steam_1", 100, baseTick),
        makeHurt(1, "steam_2", "steam_7", 100, baseTick + 400),
      ];

      const parsed = buildMinimalMatch({ kills, hurts });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player2 = result.players.find((p) => p.playerId === "steam_2");
      expect(player2?.tradeKills).toBe(0);
    });

    it("does not count same-team kills as trades", () => {
      const baseTick = 1200;
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_6", "steam_1", baseTick),
        // team2 kills team2 -- same team, not a trade
        makeKill(1, "steam_7", "steam_8", baseTick + 50),
      ];

      const parsed = buildMinimalMatch({ kills });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const totalTradeKills = result.players.reduce(
        (s, p) => s + p.tradeKills,
        0
      );
      expect(totalTradeKills).toBe(0);
    });
  });

  describe("empty events", () => {
    it("handles a match with only players and rounds (no kills, hurts, etc.)", () => {
      const parsed = buildMinimalMatch({
        kills: [],
        hurts: [],
        bombEvents: [],
        weaponFires: [],
        blinds: [],
        itemPurchases: [],
        grenadeDetonates: [],
        roundTimings: [],
      });

      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.matchId).toBe("match-123");
      expect(result.totalRounds).toBe(3);
      expect(result.teams).toHaveLength(2);
      expect(result.players).toHaveLength(10);
      expect(result.rounds).toHaveLength(3);

      for (const player of result.players) {
        expect(player.kills ?? 0).toBe(0);
        expect(player.deaths ?? 0).toBe(0);
        expect(player.adr ?? 0).toBe(0);
        expect(player.rws).toBeGreaterThanOrEqual(0);
      }
    });

    it("handles a match with zero rounds", () => {
      const parsed = buildMinimalMatch({ rounds: [], kills: [], hurts: [] });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.totalRounds).toBe(0);
      expect(result.rounds).toHaveLength(0);
      expect(result.teams).toHaveLength(2);
      expect(result.players).toHaveLength(10);
    });

    it("handles a match with no players", () => {
      const parsed = buildMinimalMatch({
        playerInfo: { players: [] },
        kills: [],
        hurts: [],
      });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.players).toHaveLength(0);
      expect(result.totalRounds).toBe(3);
    });
  });

  describe("bomb events", () => {
    it("marks rounds with bomb plant as isBombRound", () => {
      const bombEvents: ParsedDemoBombEvent[] = [
        {
          type: "planted",
          roundNumber: 2,
          playerSteamId: "steam_6",
          tick: 5500,
          site: 0,
        },
      ];

      const parsed = buildMinimalMatch({ bombEvents });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.rounds[1].isBombRound).toBe(true);
      expect(result.rounds[1].bombPlanted).toBe(true);
      expect(result.rounds[0].isBombRound).toBe(false);
    });

    it("tracks bomb defuses", () => {
      const bombEvents: ParsedDemoBombEvent[] = [
        {
          type: "planted",
          roundNumber: 2,
          playerSteamId: "steam_6",
          tick: 5500,
          site: 0,
        },
        {
          type: "defused",
          roundNumber: 2,
          playerSteamId: "steam_1",
          tick: 5800,
          site: 0,
        },
      ];

      const parsed = buildMinimalMatch({ bombEvents });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      expect(result.rounds[1].bombDefused).toBe(true);
      const planter = result.players.find((p) => p.playerId === "steam_6");
      const defuser = result.players.find((p) => p.playerId === "steam_1");
      expect(planter?.bombPlants).toBe(1);
      expect(defuser?.bombDefuses).toBe(1);
    });
  });

  describe("headshots and hs percent", () => {
    it("calculates headshot percentage", () => {
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_1", "steam_6", 1200, { headshot: true }),
        makeKill(2, "steam_1", "steam_7", 5300, { headshot: false }),
      ];

      const parsed = buildMinimalMatch({ kills });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.headshots).toBe(1);
      expect(player1?.hsPercent).toBe(50);
    });
  });

  describe("multi-kills", () => {
    it("detects a 3k round", () => {
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_1", "steam_6", 1200),
        makeKill(1, "steam_1", "steam_7", 1300),
        makeKill(1, "steam_1", "steam_8", 1400),
      ];

      const parsed = buildMinimalMatch({ kills });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.multiKills?.threeK).toBe(1);
    });

    it("detects an ace (5 kills)", () => {
      const kills: ParsedDemoKill[] = [
        makeKill(1, "steam_1", "steam_6", 1200),
        makeKill(1, "steam_1", "steam_7", 1300),
        makeKill(1, "steam_1", "steam_8", 1400),
        makeKill(1, "steam_1", "steam_9", 1500),
        makeKill(1, "steam_1", "steam_10", 1600),
      ];

      const parsed = buildMinimalMatch({ kills });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.multiKills?.ace).toBe(1);
    });
  });

  describe("opening duels", () => {
    it("tracks entry kills and entry deaths", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      // steam_1 gets first kill in round 1
      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.entryKills).toBeGreaterThanOrEqual(1);

      // steam_6 is first death in round 1
      const player6 = result.players.find((p) => p.playerId === "steam_6");
      expect(player6?.entryDeaths).toBeGreaterThanOrEqual(1);
    });
  });

  describe("KAST percentage", () => {
    it("players with kills have kastPercent > 0", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      const player1 = result.players.find((p) => p.playerId === "steam_1");
      expect(player1?.kastPercent).toBeGreaterThan(0);
    });

    it("players who survive all rounds have kastPercent of 100", () => {
      // No kills means everyone survives every round
      const parsed = buildMinimalMatch({ kills: [], hurts: [] });
      const result = buildRichDemoAnalytics(
        "match-123",
        "manual_upload",
        parsed
      );

      for (const player of result.players) {
        expect(player.kastPercent).toBe(100);
      }
    });
  });

  describe("different source types", () => {
    it("preserves faceit_api source type", () => {
      const parsed = buildMinimalMatch();
      const result = buildRichDemoAnalytics("match-456", "faceit_api", parsed);

      expect(result.sourceType).toBe("faceit_api");
    });
  });
});
