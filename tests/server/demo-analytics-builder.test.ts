import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRichDemoAnalytics } from "~/server/demo-analytics-builder";
import { parseDemoFile } from "~/server/demo-parser";

const defaultFixturePath =
  "/Users/ventsislav.nikolov/Downloads/1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3-1-1.dem.zst";
const fixturePath = process.env.DEMO_PARSER_FIXTURE_PATH ?? defaultFixturePath;

describe("buildRichDemoAnalytics", () => {
  it("produces full analytics from the real demo fixture", async () => {
    if (!existsSync(fixturePath)) {
      console.warn(`Skipping: missing demo fixture at ${fixturePath}`);
      return;
    }

    const parsed = await parseDemoFile(fixturePath);

    expect(parsed.kills.length).toBeGreaterThan(0);
    expect(parsed.hurts.length).toBeGreaterThan(0);
    expect(parsed.bombEvents.length).toBeGreaterThan(0);

    const analytics = buildRichDemoAnalytics(
      "1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3",
      "manual_upload",
      parsed
    );

    // Match basics
    expect(analytics.mapName).toBe("de_inferno");
    expect(analytics.totalRounds).toBe(20);
    expect(analytics.ingestionStatus).toBe("parsed");

    // Teams
    expect(analytics.teams).toHaveLength(2);
    const team1 = analytics.teams.find((t) => t.teamKey === "team1")!;
    const team2 = analytics.teams.find((t) => t.teamKey === "team2")!;
    expect(team1.roundsWon + team2.roundsWon).toBe(20);
    // Match ended 13-7, one team must have 13 wins
    expect([team1.roundsWon, team2.roundsWon]).toContain(13);
    expect([team1.roundsWon, team2.roundsWon]).toContain(7);
    // Sides should be detected
    expect(["CT", "T"]).toContain(team1.side);
    expect(["CT", "T"]).toContain(team2.side);
    expect(team1.side).not.toBe(team2.side);

    // Players
    expect(analytics.players).toHaveLength(10);
    for (const p of analytics.players) {
      expect(p.nickname).toBeTruthy();
      expect(p.playerId).toBeTruthy();
      expect(["team1", "team2"]).toContain(p.teamKey);
      expect(p.kills).toBeGreaterThanOrEqual(0);
      expect(p.deaths).toBeGreaterThanOrEqual(0);
      expect(p.adr).toBeGreaterThanOrEqual(0);
      expect(p.rws).toBeGreaterThanOrEqual(0);
    }

    // Total kills across players should be reasonable (100-200 for a 20 round match)
    const totalKills = analytics.players.reduce(
      (s, p) => s + (p.kills ?? 0),
      0
    );
    expect(totalKills).toBeGreaterThan(50);
    expect(totalKills).toBeLessThan(300);

    // Trade kills should exist
    const totalTradeKills = analytics.players.reduce(
      (s, p) => s + p.tradeKills,
      0
    );
    expect(totalTradeKills).toBeGreaterThan(0);

    // RWS should average roughly around 10 per round for winners
    const allRws = analytics.players.map((p) => p.rws);
    const avgRws = allRws.reduce((a, b) => a + b, 0) / allRws.length;
    expect(avgRws).toBeGreaterThan(0);
    expect(avgRws).toBeLessThan(30);

    // Rounds
    expect(analytics.rounds).toHaveLength(20);
    for (const r of analytics.rounds) {
      expect(r.winnerTeamKey).toBeTruthy();
      expect(["team1", "team2"]).toContain(r.winnerTeamKey);
    }
    // Score progression should end at 13-7
    const lastRound = analytics.rounds[analytics.rounds.length - 1];
    expect(
      [lastRound.scoreAfterRound.team1, lastRound.scoreAfterRound.team2].sort(
        (a, b) => b - a
      )
    ).toEqual([13, 7]);

    // Pistol rounds
    expect(analytics.rounds[0].isPistolRound).toBe(true);
    const round13 = analytics.rounds.find((r) => r.roundNumber === 13);
    expect(round13?.isPistolRound).toBe(true);

    // Bomb events should be reflected
    const bombRounds = analytics.rounds.filter((r) => r.isBombRound);
    expect(bombRounds.length).toBeGreaterThan(0);

    // Print summary for visual verification
    console.log("\n=== DEMO ANALYTICS SUMMARY ===");
    console.log(`Map: ${analytics.mapName} | Rounds: ${analytics.totalRounds}`);
    console.log(
      `${team1.name.slice(0, 30)} (${team1.side}): ${team1.roundsWon} wins | TK: ${team1.tradeKills} UD: ${team1.untradedDeaths} RWS: ${team1.rws}`
    );
    console.log(
      `${team2.name.slice(0, 30)} (${team2.side}): ${team2.roundsWon} wins | TK: ${team2.tradeKills} UD: ${team2.untradedDeaths} RWS: ${team2.rws}`
    );
    console.log("\nPlayers:");
    const sorted = [...analytics.players].sort(
      (a, b) => (b.kills ?? 0) - (a.kills ?? 0)
    );
    for (const p of sorted) {
      console.log(
        `  ${p.teamKey} ${p.nickname.padEnd(14)} K:${String(p.kills).padStart(2)} D:${String(p.deaths).padStart(2)} A:${String(p.assists).padStart(2)} ADR:${String(p.adr).padStart(5)} TK:${String(p.tradeKills).padStart(2)} UD:${String(p.untradedDeaths).padStart(2)} RWS:${String(p.rws).padStart(5)}`
      );
    }
    console.log(
      "\nScore:",
      analytics.rounds
        .map((r) => (r.winnerTeamKey === "team1" ? "1" : "2"))
        .join("")
    );
  });
});
