import { describe, expect, it, vi } from "vitest";
import type {
  DemoAnalyticsIngestionStore,
  IngestParsedDemoFileOptions,
  ParsedDemoFile,
} from "~/server/demo-parser";
import { ingestParsedDemoFile } from "~/server/demo-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStore(
  overrides?: Partial<DemoAnalyticsIngestionStore>
): DemoAnalyticsIngestionStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    upsertDemoIngestion: vi.fn(async () => {
      calls.push("upsertDemoIngestion");
      return { id: "ingestion-1" };
    }),
    markDemoIngestionParsing: vi.fn(async () => {
      calls.push("markDemoIngestionParsing");
    }),
    markDemoIngestionParsed: vi.fn(async () => {
      calls.push("markDemoIngestionParsed");
    }),
    markDemoIngestionFailed: vi.fn(async () => {
      calls.push("markDemoIngestionFailed");
    }),
    saveDemoAnalytics: vi.fn(async () => {
      calls.push("saveDemoAnalytics");
      return { demoMatchId: "demo-match-1" };
    }),
    ...overrides,
  };
}

function createMinimalParsedDemo(
  overrides?: Partial<ParsedDemoFile>
): ParsedDemoFile {
  return {
    header: { mapName: "de_dust2" },
    playerInfo: {
      players: [
        { index: 0, nickname: "Player1", steamId: "STEAM_1", teamNumber: 2 },
        { index: 1, nickname: "Player2", steamId: "STEAM_2", teamNumber: 3 },
      ],
    },
    rounds: [
      { roundNumber: 1, totalRoundsPlayed: 1, winner: 2, reason: "ct_win" },
      { roundNumber: 2, totalRoundsPlayed: 2, winner: 3, reason: "t_win" },
    ],
    kills: [
      {
        tick: 1000,
        roundNumber: 1,
        attackerSteamId: "STEAM_1",
        attackerName: "Player1",
        victimSteamId: "STEAM_2",
        victimName: "Player2",
        assisterSteamId: null,
        assistedFlash: false,
        headshot: true,
        weapon: "ak47",
        penetrated: false,
        thruSmoke: false,
        attackerBlind: false,
        noscope: false,
        distance: 15.5,
      },
    ],
    hurts: [
      {
        tick: 999,
        roundNumber: 1,
        attackerSteamId: "STEAM_1",
        victimSteamId: "STEAM_2",
        damage: 100,
        weapon: "ak47",
      },
    ],
    bombEvents: [
      {
        tick: 2000,
        roundNumber: 2,
        playerSteamId: "STEAM_2",
        type: "planted",
        site: 0,
      },
    ],
    weaponFires: [
      {
        tick: 998,
        roundNumber: 1,
        playerSteamId: "STEAM_1",
        weapon: "ak47",
      },
    ],
    blinds: [
      {
        tick: 900,
        roundNumber: 1,
        attackerSteamId: "STEAM_1",
        victimSteamId: "STEAM_2",
        duration: 3.5,
      },
    ],
    roundTimings: [
      { roundNumber: 1, freezeEndTick: 500 },
      { roundNumber: 2, freezeEndTick: 3500 },
    ],
    itemPurchases: [
      {
        tick: 100,
        roundNumber: 1,
        steamId: "STEAM_1",
        nickname: "Player1",
        itemName: "ak47",
        cost: 2700,
      },
    ],
    grenadeDetonates: [
      {
        tick: 950,
        roundNumber: 1,
        steamId: "STEAM_1",
        nickname: "Player1",
        type: "flash",
        x: 100,
        y: 200,
        z: 50,
      },
    ],
    ...overrides,
  };
}

function baseOptions(
  store: DemoAnalyticsIngestionStore,
  parsedDemo: ParsedDemoFile,
  overrides?: Partial<IngestParsedDemoFileOptions>
): IngestParsedDemoFileOptions {
  return {
    matchId: "match-1",
    sourceType: "faceit_demo_url",
    fileSha256: "abc123",
    store,
    parseDemoFile: async () => parsedDemo,
    buildAnalytics: (_matchId, _sourceType, parsed) => ({
      matchId: _matchId,
      sourceType: _sourceType,
      availability: "available",
      ingestionStatus: "parsed",
      mapName: parsed.header.mapName,
      totalRounds: parsed.rounds.length,
      teams: [],
      players: [],
      rounds: [],
    }),
    startedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ingestParsedDemoFile", () => {
  describe("happy path", () => {
    it("calls store methods in correct order", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile("/fake/demo.dem", baseOptions(store, parsed));

      expect(store.calls).toEqual([
        "upsertDemoIngestion",
        "markDemoIngestionParsing",
        "saveDemoAnalytics",
        "markDemoIngestionParsed",
      ]);
    });

    it("returns the parsed demo file", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      const result = await ingestParsedDemoFile(
        "/fake/demo.dem",
        baseOptions(store, parsed)
      );

      expect(result).toBe(parsed);
    });

    it("passes correct ingestion input to upsertDemoIngestion", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile(
        "/fake/demo.dem",
        baseOptions(store, parsed, {
          fileName: "match.dem",
          fileSizeBytes: 5000,
          compression: "zst",
          parserVersion: "1.0.0",
          demoPatchVersion: "v2",
          sourceUrl: "https://example.com/demo.dem",
        })
      );

      expect(store.upsertDemoIngestion).toHaveBeenCalledWith({
        faceitMatchId: "match-1",
        sourceType: "faceit_demo_url",
        sourceUrl: "https://example.com/demo.dem",
        fileName: "match.dem",
        fileSizeBytes: 5000,
        fileSha256: "abc123",
        compression: "zst",
        parserVersion: "1.0.0",
        demoPatchVersion: "v2",
      });
    });

    it("passes ingestion id to markDemoIngestionParsing", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile("/fake/demo.dem", baseOptions(store, parsed));

      expect(store.markDemoIngestionParsing).toHaveBeenCalledWith(
        "ingestion-1",
        "2026-01-01T00:00:00.000Z"
      );
    });

    it("passes analytics to saveDemoAnalytics", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile("/fake/demo.dem", baseOptions(store, parsed));

      expect(store.saveDemoAnalytics).toHaveBeenCalledWith(
        "ingestion-1",
        expect.objectContaining({
          matchId: "match-1",
          sourceType: "faceit_demo_url",
          mapName: "de_dust2",
          totalRounds: 2,
        })
      );
    });

    it("marks ingestion as parsed on success", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile("/fake/demo.dem", baseOptions(store, parsed));

      expect(store.markDemoIngestionParsed).toHaveBeenCalledWith("ingestion-1");
    });
  });

  describe("error path", () => {
    it("marks ingestion as failed when parser throws", async () => {
      const store = createMockStore();

      const opts = baseOptions(store, createMinimalParsedDemo(), {
        parseDemoFile: async () => {
          throw new Error("corrupt demo file");
        },
      });

      await expect(ingestParsedDemoFile("/fake/bad.dem", opts)).rejects.toThrow(
        "corrupt demo file"
      );

      expect(store.markDemoIngestionFailed).toHaveBeenCalledWith(
        "ingestion-1",
        "corrupt demo file",
        expect.any(String)
      );
    });

    it("marks ingestion as failed when buildAnalytics throws", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      const opts = baseOptions(store, parsed, {
        buildAnalytics: () => {
          throw new Error("analytics build failed");
        },
      });

      await expect(
        ingestParsedDemoFile("/fake/demo.dem", opts)
      ).rejects.toThrow("analytics build failed");

      expect(store.markDemoIngestionFailed).toHaveBeenCalledWith(
        "ingestion-1",
        "analytics build failed",
        expect.any(String)
      );
    });

    it("marks ingestion as failed with stringified non-Error", async () => {
      const store = createMockStore();

      const opts = baseOptions(store, createMinimalParsedDemo(), {
        parseDemoFile: async () => {
          throw "raw string error";
        },
      });

      await expect(ingestParsedDemoFile("/fake/demo.dem", opts)).rejects.toBe(
        "raw string error"
      );

      expect(store.markDemoIngestionFailed).toHaveBeenCalledWith(
        "ingestion-1",
        "raw string error",
        expect.any(String)
      );
    });

    it("does not call markDemoIngestionParsed on failure", async () => {
      const store = createMockStore();

      const opts = baseOptions(store, createMinimalParsedDemo(), {
        parseDemoFile: async () => {
          throw new Error("fail");
        },
      });

      await expect(
        ingestParsedDemoFile("/fake/demo.dem", opts)
      ).rejects.toThrow();

      expect(store.markDemoIngestionParsed).not.toHaveBeenCalled();
    });

    it("does not call saveDemoAnalytics when parser fails", async () => {
      const store = createMockStore();

      const opts = baseOptions(store, createMinimalParsedDemo(), {
        parseDemoFile: async () => {
          throw new Error("fail");
        },
      });

      await expect(
        ingestParsedDemoFile("/fake/demo.dem", opts)
      ).rejects.toThrow();

      expect(store.saveDemoAnalytics).not.toHaveBeenCalled();
    });
  });

  describe("defaults", () => {
    it("defaults optional fields to null", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      await ingestParsedDemoFile("/fake/demo.dem", baseOptions(store, parsed));

      expect(store.upsertDemoIngestion).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUrl: null,
          fileName: null,
          fileSizeBytes: null,
          parserVersion: null,
          demoPatchVersion: null,
        })
      );
    });
  });

  describe("normalizer coverage via buildAnalytics passthrough", () => {
    it("processes demo with all event types populated", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();
      let receivedParsed: ParsedDemoFile | null = null;

      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed).not.toBeNull();
      expect(receivedParsed!.header.mapName).toBe("de_dust2");
      expect(receivedParsed!.kills).toHaveLength(1);
      expect(receivedParsed!.kills[0].headshot).toBe(true);
      expect(receivedParsed!.hurts).toHaveLength(1);
      expect(receivedParsed!.hurts[0].damage).toBe(100);
      expect(receivedParsed!.bombEvents).toHaveLength(1);
      expect(receivedParsed!.bombEvents[0].type).toBe("planted");
      expect(receivedParsed!.weaponFires).toHaveLength(1);
      expect(receivedParsed!.blinds).toHaveLength(1);
      expect(receivedParsed!.blinds[0].duration).toBe(3.5);
      expect(receivedParsed!.roundTimings).toHaveLength(2);
      expect(receivedParsed!.itemPurchases).toHaveLength(1);
      expect(receivedParsed!.itemPurchases[0].cost).toBe(2700);
      expect(receivedParsed!.grenadeDetonates).toHaveLength(1);
      expect(receivedParsed!.grenadeDetonates[0].type).toBe("flash");
      expect(receivedParsed!.playerInfo.players).toHaveLength(2);
      expect(receivedParsed!.rounds).toHaveLength(2);
    });

    it("handles empty event arrays", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        kills: [],
        hurts: [],
        bombEvents: [],
        weaponFires: [],
        blinds: [],
        roundTimings: [],
        itemPurchases: [],
        grenadeDetonates: [],
        rounds: [],
        playerInfo: { players: [] },
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: 0,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed).not.toBeNull();
      expect(receivedParsed!.kills).toHaveLength(0);
      expect(receivedParsed!.hurts).toHaveLength(0);
      expect(receivedParsed!.bombEvents).toHaveLength(0);
      expect(receivedParsed!.weaponFires).toHaveLength(0);
      expect(receivedParsed!.blinds).toHaveLength(0);
      expect(receivedParsed!.roundTimings).toHaveLength(0);
      expect(receivedParsed!.itemPurchases).toHaveLength(0);
      expect(receivedParsed!.grenadeDetonates).toHaveLength(0);
      expect(receivedParsed!.playerInfo.players).toHaveLength(0);
      expect(receivedParsed!.rounds).toHaveLength(0);
    });

    it("handles multiple grenade types", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        grenadeDetonates: [
          {
            tick: 100,
            roundNumber: 1,
            steamId: "STEAM_1",
            nickname: "Player1",
            type: "smoke",
            x: 10,
            y: 20,
            z: 30,
          },
          {
            tick: 200,
            roundNumber: 1,
            steamId: "STEAM_1",
            nickname: "Player1",
            type: "flash",
            x: 11,
            y: 21,
            z: 31,
          },
          {
            tick: 300,
            roundNumber: 1,
            steamId: "STEAM_1",
            nickname: "Player1",
            type: "he",
            x: 12,
            y: 22,
            z: 32,
          },
          {
            tick: 400,
            roundNumber: 1,
            steamId: "STEAM_2",
            nickname: "Player2",
            type: "molotov",
            x: 13,
            y: 23,
            z: 33,
          },
        ],
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed!.grenadeDetonates).toHaveLength(4);
      const types = receivedParsed!.grenadeDetonates.map((g) => g.type);
      expect(types).toEqual(["smoke", "flash", "he", "molotov"]);
    });

    it("handles bomb defused event", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        bombEvents: [
          {
            tick: 2000,
            roundNumber: 2,
            playerSteamId: "STEAM_2",
            type: "planted",
            site: 0,
          },
          {
            tick: 3000,
            roundNumber: 2,
            playerSteamId: "STEAM_1",
            type: "defused",
            site: null,
          },
        ],
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed!.bombEvents).toHaveLength(2);
      expect(receivedParsed!.bombEvents[0].type).toBe("planted");
      expect(receivedParsed!.bombEvents[0].site).toBe(0);
      expect(receivedParsed!.bombEvents[1].type).toBe("defused");
      expect(receivedParsed!.bombEvents[1].site).toBeNull();
    });

    it("handles kill with assister and special flags", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        kills: [
          {
            tick: 1000,
            roundNumber: 1,
            attackerSteamId: "STEAM_1",
            attackerName: "Player1",
            victimSteamId: "STEAM_2",
            victimName: "Player2",
            assisterSteamId: "STEAM_3",
            assistedFlash: true,
            headshot: false,
            weapon: "awp",
            penetrated: true,
            thruSmoke: true,
            attackerBlind: true,
            noscope: true,
            distance: 42.7,
          },
        ],
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      const kill = receivedParsed!.kills[0];
      expect(kill.assisterSteamId).toBe("STEAM_3");
      expect(kill.assistedFlash).toBe(true);
      expect(kill.penetrated).toBe(true);
      expect(kill.thruSmoke).toBe(true);
      expect(kill.attackerBlind).toBe(true);
      expect(kill.noscope).toBe(true);
      expect(kill.distance).toBe(42.7);
    });

    it("handles players with null team number", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        playerInfo: {
          players: [
            {
              index: 0,
              nickname: "Spectator",
              steamId: "STEAM_SPEC",
              teamNumber: null,
            },
          ],
        },
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed!.playerInfo.players[0].teamNumber).toBeNull();
    });

    it("handles round with null winner and reason", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo({
        rounds: [
          {
            roundNumber: 1,
            totalRoundsPlayed: 1,
            winner: null,
            reason: null,
          },
        ],
      });

      let receivedParsed: ParsedDemoFile | null = null;
      const opts = baseOptions(store, parsed, {
        buildAnalytics: (_matchId, _sourceType, p) => {
          receivedParsed = p;
          return {
            matchId: _matchId,
            sourceType: _sourceType,
            availability: "available",
            ingestionStatus: "parsed",
            mapName: p.header.mapName,
            totalRounds: p.rounds.length,
            teams: [],
            players: [],
            rounds: [],
          };
        },
      });

      await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(receivedParsed!.rounds[0].winner).toBeNull();
      expect(receivedParsed!.rounds[0].reason).toBeNull();
    });
  });

  describe("parsedDemoToMinimalAnalytics via default buildAnalytics", () => {
    it("uses default buildAnalytics when none provided", async () => {
      const store = createMockStore();
      const parsed = createMinimalParsedDemo();

      const opts: IngestParsedDemoFileOptions = {
        matchId: "match-1",
        sourceType: "faceit_demo_url",
        fileSha256: "abc123",
        store,
        parseDemoFile: async () => parsed,
        startedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await ingestParsedDemoFile("/fake/demo.dem", opts);

      expect(result).toBe(parsed);
      expect(store.saveDemoAnalytics).toHaveBeenCalledWith(
        "ingestion-1",
        expect.objectContaining({
          matchId: "match-1",
          mapName: "de_dust2",
        })
      );
    });
  });
});
