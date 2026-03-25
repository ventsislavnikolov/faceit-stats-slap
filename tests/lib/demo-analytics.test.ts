import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRADE_WINDOW_SECONDS,
  RWS_BOMB_BONUS_POINTS,
  buildRoundScoreProgression,
  buildWinLossStreaks,
  classifyExitKill,
  classifyTradeKill,
  computeRwsForRound,
} from "~/lib/demo-analytics";

describe("demo analytics helpers", () => {
  it("classifies trade kills only inside the configured window", () => {
    expect(
      classifyTradeKill({
        killerTeamKey: "team1",
        victimTeamKey: "team2",
        killAtSeconds: 16,
        victimDeathAtSeconds: 12,
      }),
    ).toBe(true);

    expect(
      classifyTradeKill({
        killerTeamKey: "team1",
        victimTeamKey: "team2",
        killAtSeconds: 12 + DEFAULT_TRADE_WINDOW_SECONDS + 1,
        victimDeathAtSeconds: 12,
      }),
    ).toBe(false);
  });

  it("classifies exit kills only after the bomb has been planted", () => {
    expect(
      classifyExitKill({
        killerTeamKey: "team1",
        victimTeamKey: "team2",
        killAtSeconds: 42,
        bombPlantedAtSeconds: 30,
        roundEndedAtSeconds: 45,
      }),
    ).toBe(true);

    expect(
      classifyExitKill({
        killerTeamKey: "team1",
        victimTeamKey: "team2",
        killAtSeconds: 28,
        bombPlantedAtSeconds: 30,
        roundEndedAtSeconds: 45,
      }),
    ).toBe(false);
  });

  it("builds score progression through the last round of a half", () => {
    const progression = buildRoundScoreProgression([
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
      "team2",
      "team1",
    ]);

    expect(progression).toHaveLength(15);
    expect(progression[14]).toEqual({
      roundNumber: 15,
      winnerTeamKey: "team1",
      scoreAfterRound: { team1: 8, team2: 7 },
    });
  });

  it("builds win and loss streaks for both teams", () => {
    const streaks = buildWinLossStreaks([
      "team1",
      "team1",
      "team2",
      "team2",
      "team2",
      "team1",
    ]);

    expect(streaks.team1).toEqual({
      longestWinStreak: 2,
      longestLossStreak: 3,
      currentWinStreak: 1,
      currentLossStreak: 0,
    });
    expect(streaks.team2).toEqual({
      longestWinStreak: 3,
      longestLossStreak: 2,
      currentWinStreak: 0,
      currentLossStreak: 1,
    });
  });

  it("gives an equal-share fallback when a won round has no team damage", () => {
    const rws = computeRwsForRound({
      winningTeamKey: "team1",
      players: [
        { playerId: "a", teamKey: "team1", damage: 0, alive: true },
        { playerId: "b", teamKey: "team1", damage: 0, alive: true },
        { playerId: "c", teamKey: "team1", damage: 0, alive: true },
        { playerId: "d", teamKey: "team1", damage: 0, alive: true },
        { playerId: "e", teamKey: "team1", damage: 0, alive: true },
        { playerId: "x", teamKey: "team2", damage: 0, alive: true },
        { playerId: "y", teamKey: "team2", damage: 0, alive: true },
      ],
    });

    expect(rws).toEqual({
      a: 20,
      b: 20,
      c: 20,
      d: 20,
      e: 20,
      x: 0,
      y: 0,
    });
  });

  it("distributes RWS proportionally when the winning team has live damage", () => {
    const rws = computeRwsForRound({
      winningTeamKey: "team1",
      players: [
        { playerId: "a", teamKey: "team1", damage: 50, alive: true },
        { playerId: "b", teamKey: "team1", damage: 30, alive: true },
        { playerId: "c", teamKey: "team1", damage: 20, alive: true },
      ],
    });

    expect(rws.a).toBe(50);
    expect(rws.b).toBe(30);
    expect(rws.c).toBe(20);
  });

  it("preserves the full round value in a normal round", () => {
    const rws = computeRwsForRound({
      winningTeamKey: "team1",
      players: [
        { playerId: "a", teamKey: "team1", damage: 60, alive: true },
        { playerId: "b", teamKey: "team1", damage: 25, alive: true },
        { playerId: "c", teamKey: "team1", damage: 15, alive: true },
      ],
    });

    const total = rws.a + rws.b + rws.c;

    expect(total).toBe(100);
  });

  it("uses an explicit equal-share fallback when no winners are alive", () => {
    const rws = computeRwsForRound({
      winningTeamKey: "team1",
      players: [
        { playerId: "a", teamKey: "team1", damage: 40, alive: false },
        { playerId: "b", teamKey: "team1", damage: 30, alive: false },
        { playerId: "c", teamKey: "team1", damage: 30, alive: false },
      ],
    });

    expect(rws).toEqual({
      a: 33.333333333333336,
      b: 33.333333333333336,
      c: 33.333333333333336,
    });
  });

  it("applies the bomb bonus before sharing the remaining round value", () => {
    const rws = computeRwsForRound({
      winningTeamKey: "team1",
      bombBonusPlayerId: "a",
      players: [
        { playerId: "a", teamKey: "team1", damage: 0, alive: true },
        { playerId: "b", teamKey: "team1", damage: 0, alive: true },
        { playerId: "c", teamKey: "team1", damage: 0, alive: true },
        { playerId: "d", teamKey: "team1", damage: 0, alive: true },
        { playerId: "e", teamKey: "team1", damage: 0, alive: true },
      ],
    });

    expect(RWS_BOMB_BONUS_POINTS).toBe(30);
    expect(rws.a).toBe(30 + 14);
    expect(rws.b).toBe(14);
    expect(rws.c).toBe(14);
    expect(rws.d).toBe(14);
    expect(rws.e).toBe(14);
  });
});
