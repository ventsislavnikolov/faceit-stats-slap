import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { execFileSync } from "node:child_process";
import { decompress } from "fzstd";
import { parseEvents, parseHeader, parsePlayerInfo } from "@laihoe/demoparser2";
import type { DemoMatchAnalytics, DemoAnalyticsSourceType } from "~/lib/types";
import { buildRichDemoAnalytics } from "~/server/demo-analytics-builder";
import { createServerSupabase } from "~/lib/supabase.server";
import {
  type CreateIngestionInput,
  type IngestionRow,
  markDemoIngestionFailed,
  markDemoIngestionParsed,
  markDemoIngestionParsing,
  saveDemoAnalytics,
  upsertDemoIngestion,
} from "~/server/demo-analytics-store";

const DEMO_EVENT_NAMES = [
  "round_start",
  "round_end",
  "round_freeze_end",
  "player_death",
  "player_hurt",
  "player_blind",
  "weapon_fire",
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
  "item_purchase",
  "smokegrenade_detonate",
  "flashbang_detonate",
  "hegrenade_detonate",
  "inferno_startburn",
] as const;

type RawHeader = Record<string, unknown> & {
  map_name?: string;
};

type RawPlayerInfo = Record<string, unknown> & {
  name?: string;
  steamid?: string;
  team_number?: number;
};

type RawDemoEvent = Record<string, unknown> & {
  event_name?: string;
  round?: number;
  total_rounds_played?: number;
  winner?: unknown;
};

export interface ParsedDemoPlayer {
  index: number;
  nickname: string;
  steamId: string;
  teamNumber: number | null;
}

export interface ParsedDemoRound {
  roundNumber: number;
  totalRoundsPlayed: number | null;
  winner: unknown;
  reason: string | null;
}

export interface ParsedDemoKill {
  tick: number;
  roundNumber: number;
  attackerSteamId: string;
  attackerName: string;
  victimSteamId: string;
  victimName: string;
  assisterSteamId: string | null;
  assistedFlash: boolean;
  headshot: boolean;
  weapon: string;
  penetrated: boolean;
  thruSmoke: boolean;
  attackerBlind: boolean;
  noscope: boolean;
  distance: number;
}

export interface ParsedDemoHurt {
  tick: number;
  roundNumber: number;
  attackerSteamId: string;
  victimSteamId: string;
  damage: number;
  weapon: string;
}

export interface ParsedDemoBombEvent {
  tick: number;
  roundNumber: number;
  playerSteamId: string;
  type: "planted" | "defused";
  site: number | null;
}

export interface ParsedDemoWeaponFire {
  tick: number;
  roundNumber: number;
  playerSteamId: string;
  weapon: string;
}

export interface ParsedDemoBlind {
  tick: number;
  roundNumber: number;
  attackerSteamId: string;
  victimSteamId: string;
  duration: number;
}

export interface ParsedDemoRoundTiming {
  roundNumber: number;
  freezeEndTick: number;
}

export interface ParsedDemoItemPurchase {
  tick: number;
  roundNumber: number;
  steamId: string;
  nickname: string;
  itemName: string;
  cost: number;
}

export interface ParsedDemoGrenadeDetonate {
  tick: number;
  roundNumber: number;
  steamId: string;
  nickname: string;
  type: "smoke" | "flash" | "he" | "molotov";
  x: number;
  y: number;
  z: number;
}

export interface ParsedDemoFile {
  header: {
    mapName: string;
  };
  playerInfo: {
    players: ParsedDemoPlayer[];
  };
  rounds: ParsedDemoRound[];
  kills: ParsedDemoKill[];
  hurts: ParsedDemoHurt[];
  bombEvents: ParsedDemoBombEvent[];
  weaponFires: ParsedDemoWeaponFire[];
  blinds: ParsedDemoBlind[];
  roundTimings: ParsedDemoRoundTiming[];
  itemPurchases: ParsedDemoItemPurchase[];
  grenadeDetonates: ParsedDemoGrenadeDetonate[];
}

// ---------------------------------------------------------------------------
// Store interface — matches the public API of demo-analytics-store.ts
// ---------------------------------------------------------------------------

export interface DemoAnalyticsIngestionStore {
  upsertDemoIngestion: (input: CreateIngestionInput) => Promise<IngestionRow>;
  markDemoIngestionParsing: (ingestionId: string, startedAt?: string) => Promise<void>;
  markDemoIngestionFailed: (ingestionId: string, errorMessage: string, finishedAt?: string) => Promise<void>;
  markDemoIngestionParsed: (ingestionId: string, finishedAt?: string) => Promise<void>;
  saveDemoAnalytics: (
    ingestionId: string,
    analytics: DemoMatchAnalytics,
  ) => Promise<{ demoMatchId: string }>;
}

export interface IngestParsedDemoFileOptions {
  matchId: string;
  sourceType: DemoAnalyticsSourceType;
  fileSha256: string;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  sourceUrl?: string | null;
  compression?: "dem" | "zst";
  parserVersion?: string | null;
  demoPatchVersion?: string | null;
  startedAt?: string;
  store?: DemoAnalyticsIngestionStore;
  parseDemoFile?: typeof parseDemoFile;
  buildAnalytics?: (
    matchId: string,
    sourceType: DemoAnalyticsSourceType,
    parsed: ParsedDemoFile,
  ) => DemoMatchAnalytics;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  return Object.values(value) as T[];
}

function readDemoBuffer(filePath: string) {
  const isCompressed = extname(filePath).toLowerCase() === ".zst";
  if (!isCompressed) return readFileSync(filePath);

  // Try native zstd first (handles large files), fall back to fzstd
  try {
    return execFileSync("zstd", ["-d", "--stdout", filePath], {
      maxBuffer: 2 * 1024 * 1024 * 1024,
    });
  } catch {
    const fileBytes = readFileSync(filePath);
    return Buffer.from(decompress(fileBytes));
  }
}

function normalizePlayers(players: RawPlayerInfo[]): ParsedDemoPlayer[] {
  return players.map((player, index) => ({
    index,
    nickname: String(player.name ?? ""),
    steamId: String(player.steamid ?? ""),
    teamNumber: typeof player.team_number === "number" ? player.team_number : null,
  }));
}

function normalizeRounds(roundEndEvents: RawDemoEvent[], roundStartEvents: RawDemoEvent[]): ParsedDemoRound[] {
  const sourceRounds = roundEndEvents.length > 0 ? roundEndEvents : roundStartEvents;
  const roundsByTotal = new Map<number, RawDemoEvent>();

  for (const event of sourceRounds) {
    const totalRoundsPlayed =
      typeof event.total_rounds_played === "number" ? event.total_rounds_played : null;
    if (totalRoundsPlayed === null || totalRoundsPlayed <= 0) continue;
    roundsByTotal.set(totalRoundsPlayed, event);
  }

  return [...roundsByTotal.entries()]
    .sort(([left], [right]) => left - right)
    .map(([totalRoundsPlayed, event]) => ({
      roundNumber: totalRoundsPlayed,
      totalRoundsPlayed,
      winner: event.winner ?? null,
      reason: typeof event.reason === "string" ? event.reason : null,
    }));
}

function normalizeKills(events: RawDemoEvent[]): ParsedDemoKill[] {
  return events
    .filter((e) => e.event_name === "player_death" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      attackerSteamId: String(e.attacker_steamid ?? ""),
      attackerName: String(e.attacker_name ?? ""),
      victimSteamId: String(e.user_steamid ?? ""),
      victimName: String(e.user_name ?? ""),
      assisterSteamId: e.assister_steamid ? String(e.assister_steamid) : null,
      assistedFlash: Boolean(e.assistedflash),
      headshot: Boolean(e.headshot),
      weapon: String(e.weapon ?? ""),
      penetrated: Number(e.penetrated ?? 0) > 0,
      thruSmoke: Boolean(e.thrusmoke),
      attackerBlind: Boolean(e.attackerblind),
      noscope: Boolean(e.noscope),
      distance: Number(e.distance ?? 0),
    }));
}

function normalizeHurts(events: RawDemoEvent[]): ParsedDemoHurt[] {
  return events
    .filter((e) => e.event_name === "player_hurt" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      attackerSteamId: String(e.attacker_steamid ?? ""),
      victimSteamId: String(e.user_steamid ?? ""),
      damage: Number(e.dmg_health ?? 0),
      weapon: String(e.weapon ?? ""),
    }));
}

function normalizeBombEvents(events: RawDemoEvent[]): ParsedDemoBombEvent[] {
  return events
    .filter(
      (e) =>
        (e.event_name === "bomb_planted" || e.event_name === "bomb_defused") &&
        typeof e.total_rounds_played === "number" &&
        e.total_rounds_played > 0,
    )
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      playerSteamId: String(e.user_steamid ?? ""),
      type: e.event_name === "bomb_planted" ? "planted" as const : "defused" as const,
      site: typeof e.site === "number" ? e.site : null,
    }));
}

function normalizeWeaponFires(events: RawDemoEvent[]): ParsedDemoWeaponFire[] {
  return events
    .filter((e) => e.event_name === "weapon_fire" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      playerSteamId: String(e.user_steamid ?? ""),
      weapon: String(e.weapon ?? "").replace(/^weapon_/, ""),
    }));
}

function normalizeBlinds(events: RawDemoEvent[]): ParsedDemoBlind[] {
  return events
    .filter((e) => e.event_name === "player_blind" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      attackerSteamId: String(e.attacker_steamid ?? ""),
      victimSteamId: String(e.user_steamid ?? ""),
      duration: Number(e.blind_duration ?? 0),
    }));
}

function normalizeItemPurchases(events: RawDemoEvent[]): ParsedDemoItemPurchase[] {
  return events
    .filter((e) => e.event_name === "item_purchase" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      steamId: String(e.steamid ?? ""),
      nickname: String(e.name ?? ""),
      itemName: String(e.item_name ?? ""),
      cost: Number(e.cost ?? 0),
    }));
}

const GRENADE_EVENT_TO_TYPE: Record<string, ParsedDemoGrenadeDetonate["type"]> = {
  smokegrenade_detonate: "smoke",
  flashbang_detonate: "flash",
  hegrenade_detonate: "he",
  inferno_startburn: "molotov",
};

function normalizeGrenadeDetonates(events: RawDemoEvent[]): ParsedDemoGrenadeDetonate[] {
  return events
    .filter((e) => e.event_name && e.event_name in GRENADE_EVENT_TO_TYPE && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      steamId: String(e.user_steamid ?? ""),
      nickname: String(e.user_name ?? ""),
      type: GRENADE_EVENT_TO_TYPE[e.event_name!]!,
      x: Number(e.x ?? 0),
      y: Number(e.y ?? 0),
      z: Number(e.z ?? 0),
    }));
}

function normalizeRoundTimings(events: RawDemoEvent[]): ParsedDemoRoundTiming[] {
  const byRound = new Map<number, number>();
  for (const e of events) {
    if (e.event_name !== "round_freeze_end") continue;
    const rn = typeof e.total_rounds_played === "number" ? e.total_rounds_played : -1;
    if (rn <= 0) continue;
    byRound.set(rn, Number(e.tick ?? 0));
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, freezeEndTick]) => ({ roundNumber, freezeEndTick }));
}

function parsedDemoToMinimalAnalytics(
  matchId: string,
  sourceType: DemoAnalyticsSourceType,
  parsed: ParsedDemoFile,
): DemoMatchAnalytics {
  return {
    matchId,
    sourceType,
    availability: "available",
    ingestionStatus: "parsed",
    mapName: parsed.header.mapName,
    totalRounds: parsed.rounds.length,
    teams: [],
    players: parsed.playerInfo.players.map((p) => ({
      nickname: p.nickname,
      teamKey: (p.teamNumber === 2 ? "team1" : "team2") as "team1" | "team2",
      tradeKills: 0,
      untradedDeaths: 0,
      rws: 0,
      playerId: p.steamId || undefined,
    })),
    rounds: parsed.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      winnerTeamKey: null,
      winnerSide: null,
      isPistolRound: r.roundNumber === 1 || r.roundNumber === 16,
      isBombRound: false,
      scoreAfterRound: { team1: 0, team2: 0 },
    })),
  };
}

function getDefaultDemoAnalyticsStore(): DemoAnalyticsIngestionStore {
  const supabase = createServerSupabase();
  return {
    upsertDemoIngestion: (input) => upsertDemoIngestion(supabase, input),
    markDemoIngestionParsing: (id, startedAt) => markDemoIngestionParsing(supabase, id, startedAt),
    markDemoIngestionFailed: (id, msg, finishedAt) => markDemoIngestionFailed(supabase, id, msg, finishedAt),
    markDemoIngestionParsed: (id, finishedAt) => markDemoIngestionParsed(supabase, id, finishedAt),
    saveDemoAnalytics: (id, analytics) => saveDemoAnalytics(supabase, id, analytics),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function parseDemoFile(filePath: string): Promise<ParsedDemoFile> {
  const buffer = readDemoBuffer(filePath);
  const header = parseHeader(buffer) as RawHeader;
  const playerInfo = asArray<RawPlayerInfo>(parsePlayerInfo(buffer));
  const rawEvents = asArray<RawDemoEvent>(
    parseEvents(buffer, [...DEMO_EVENT_NAMES], ["X", "Y"], ["total_rounds_played"]),
  );
  const roundStart = rawEvents.filter((event) => event.event_name === "round_start");
  const roundEnd = rawEvents.filter((event) => event.event_name === "round_end");
  const rounds = normalizeRounds(roundEnd, roundStart);

  return {
    header: { mapName: String(header.map_name ?? "") },
    playerInfo: { players: normalizePlayers(playerInfo) },
    rounds,
    kills: normalizeKills(rawEvents),
    hurts: normalizeHurts(rawEvents),
    bombEvents: normalizeBombEvents(rawEvents),
    weaponFires: normalizeWeaponFires(rawEvents),
    blinds: normalizeBlinds(rawEvents),
    roundTimings: normalizeRoundTimings(rawEvents),
    itemPurchases: normalizeItemPurchases(rawEvents),
    grenadeDetonates: normalizeGrenadeDetonates(rawEvents),
  };
}

export async function ingestParsedDemoFile(
  filePath: string,
  options: IngestParsedDemoFileOptions,
): Promise<ParsedDemoFile> {
  const store = options.store ?? getDefaultDemoAnalyticsStore();
  const parseFile = options.parseDemoFile ?? parseDemoFile;
  const buildAnalyticsFn = options.buildAnalytics ?? buildRichDemoAnalytics;
  const startedAt = options.startedAt ?? new Date().toISOString();

  // 1. Create ingestion row
  const { id: ingestionId } = await store.upsertDemoIngestion({
    faceitMatchId: options.matchId,
    sourceType: options.sourceType,
    sourceUrl: options.sourceUrl ?? null,
    fileName: options.fileName ?? null,
    fileSizeBytes: options.fileSizeBytes ?? null,
    fileSha256: options.fileSha256,
    compression: options.compression,
    parserVersion: options.parserVersion ?? null,
    demoPatchVersion: options.demoPatchVersion ?? null,
  });

  // 2. Mark as parsing
  await store.markDemoIngestionParsing(ingestionId, startedAt);

  try {
    // 3. Parse
    const parsed = await parseFile(filePath);

    // 4. Build analytics and save
    const analytics = buildAnalyticsFn(options.matchId, options.sourceType, parsed);
    await store.saveDemoAnalytics(ingestionId, analytics);

    // 5. Mark as parsed
    await store.markDemoIngestionParsed(ingestionId);

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.markDemoIngestionFailed(ingestionId, message, new Date().toISOString());
    throw error;
  }
}
