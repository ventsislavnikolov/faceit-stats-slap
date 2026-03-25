import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { decompress } from "fzstd";
import { parseEvents, parseHeader, parsePlayerInfo } from "@laihoe/demoparser2";

const DEMO_EVENT_NAMES = [
  "round_start",
  "round_end",
  "player_death",
  "player_hurt",
  "player_blind",
  "weapon_fire",
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
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
}

export interface ParsedDemoFile {
  header: {
    mapName: string;
  };
  playerInfo: {
    players: ParsedDemoPlayer[];
  };
  rounds: ParsedDemoRound[];
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value) as T[];
}

function readDemoBuffer(filePath: string) {
  const fileBytes = readFileSync(filePath);
  const isCompressed = extname(filePath).toLowerCase() === ".zst";

  if (!isCompressed) {
    return fileBytes;
  }

  return Buffer.from(decompress(fileBytes));
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

    if (totalRoundsPlayed === null || totalRoundsPlayed <= 0) {
      continue;
    }

    roundsByTotal.set(totalRoundsPlayed, event);
  }

  return [...roundsByTotal.entries()]
    .sort(([left], [right]) => left - right)
    .map(([totalRoundsPlayed, event]) => ({
      roundNumber: totalRoundsPlayed,
      totalRoundsPlayed,
      winner: event.winner ?? null,
    }));
}

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
    header: {
      mapName: String(header.map_name ?? ""),
    },
    playerInfo: {
      players: normalizePlayers(playerInfo),
    },
    rounds,
  };
}
