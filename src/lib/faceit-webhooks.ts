type FaceitWebhookEvent =
  | "match_object_created"
  | "match_status_aborted"
  | "match_status_cancelled"
  | "match_status_configuring"
  | "match_status_finished"
  | "match_status_ready";

type WebhookStateRow = {
  player_faceit_id: string;
  current_match_id: string | null;
};

type ExtractedWebhookMatchUpdate = {
  event: string;
  matchId: string | null;
  playerIds: string[];
  shouldActivate: boolean;
  shouldClear: boolean;
};

export const TRACKED_WEBHOOK_PLAYERS = {
  soavarice: {
    faceitId: "15844c99-d26e-419e-bd14-30908f502c03",
    nickname: "soavarice",
  },
  f1aw1esss: {
    faceitId: "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
    nickname: "F1aw1esss",
  },
  tibabg: {
    faceitId: "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
    nickname: "TibaBG",
  },
  vandaloo: {
    faceitId: "156e72ec-e758-42e4-9fd7-3acaefa332f5",
    nickname: "VanDaLoo",
  },
} as const;

export function getTrackedWebhookPlayerIds(): string[] {
  return Object.values(TRACKED_WEBHOOK_PLAYERS).map(
    (player) => player.faceitId
  );
}

const TRACKED_PLAYER_IDS = new Set(getTrackedWebhookPlayerIds());

const ACTIVE_EVENTS = new Set<FaceitWebhookEvent>([
  "match_object_created",
  "match_status_configuring",
  "match_status_ready",
]);

const CLEAR_EVENTS = new Set<FaceitWebhookEvent>([
  "match_status_finished",
  "match_status_cancelled",
  "match_status_aborted",
]);

function getObjectValues(input: unknown): unknown[] {
  if (!input || typeof input !== "object") {
    return [];
  }
  return Array.isArray(input) ? input : Object.values(input);
}

function collectTrackedPlayerIds(
  input: unknown,
  found = new Set<string>()
): Set<string> {
  if (!input || typeof input !== "object") {
    return found;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectTrackedPlayerIds(item, found);
    }
    return found;
  }

  const record = input as Record<string, unknown>;
  const candidateIds = [
    record.player_id,
    record.user_id,
    record.faceit_id,
    record.id,
  ];

  for (const candidate of candidateIds) {
    if (typeof candidate === "string" && TRACKED_PLAYER_IDS.has(candidate)) {
      found.add(candidate);
    }
  }

  for (const value of getObjectValues(record)) {
    collectTrackedPlayerIds(value, found);
  }

  return found;
}

function extractEventName(input: Record<string, unknown>): string {
  const candidates = [input.event, input.event_type, input.type, input.name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  const payload = input.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const state = typeof record.state === "string" ? record.state : null;
    const status = typeof record.status === "string" ? record.status : null;

    if (status === "LIVE" || state === "ONGOING") {
      return "match_status_ready";
    }
    if (state === "CONFIGURING") {
      return "match_status_configuring";
    }
    if (state === "FINISHED") {
      return "match_status_finished";
    }
    if (state === "CANCELLED") {
      return "match_status_cancelled";
    }
    if (state === "ABORTED") {
      return "match_status_aborted";
    }
  }

  return "unknown";
}

function looksLikeMatchObject(record: Record<string, unknown>): boolean {
  if (typeof record.match_id === "string") {
    return true;
  }

  const hasMatchShape =
    typeof record.status === "string" ||
    typeof record.state === "string" ||
    "teams" in record ||
    "results" in record ||
    "voting" in record;

  return hasMatchShape && typeof record.id === "string";
}

function extractMatchId(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const matchId = extractMatchId(item);
      if (matchId) {
        return matchId;
      }
    }
    return null;
  }

  const record = input as Record<string, unknown>;
  const directCandidates = [
    record.match_id,
    record.faceit_match_id,
    record.matchId,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  if (looksLikeMatchObject(record)) {
    return record.id as string;
  }

  for (const key of ["match", "payload", "data", "event_data", "object"]) {
    const nested = record[key];
    const matchId = extractMatchId(nested);
    if (matchId) {
      return matchId;
    }
  }

  return null;
}

export function extractFaceitWebhookMatchUpdate(
  body: Record<string, unknown>
): ExtractedWebhookMatchUpdate {
  const event = extractEventName(body);
  const matchId = extractMatchId(body);
  const playerIds = [...collectTrackedPlayerIds(body)];

  return {
    event,
    matchId,
    playerIds,
    shouldActivate: ACTIVE_EVENTS.has(event as FaceitWebhookEvent),
    shouldClear: CLEAR_EVENTS.has(event as FaceitWebhookEvent),
  };
}

export function groupWebhookStateByMatch(
  rows: WebhookStateRow[]
): Map<string, string[]> {
  const byMatch = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.current_match_id) {
      continue;
    }
    if (!byMatch.has(row.current_match_id)) {
      byMatch.set(row.current_match_id, []);
    }
    byMatch.get(row.current_match_id)!.push(row.player_faceit_id);
  }

  return byMatch;
}
