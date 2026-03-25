import {
  extractFaceitWebhookMatchUpdate,
  groupWebhookStateByMatch,
  TRACKED_WEBHOOK_PLAYERS,
} from "~/lib/faceit-webhooks";
import { createServerSupabase } from "~/lib/supabase.server";

type FaceitWebhookBody = Record<string, unknown>;

function getTrackedNickname(faceitId: string): string {
  const player = Object.values(TRACKED_WEBHOOK_PLAYERS).find(
    (entry) => entry.faceitId === faceitId
  );
  return player?.nickname ?? faceitId;
}

function getPersistedStatus(event: string): string {
  if (
    event === "match_object_created" ||
    event === "match_status_configuring"
  ) {
    return "CONFIGURING";
  }
  if (event === "match_status_ready") {
    return "READY";
  }
  if (event === "match_status_finished") {
    return "FINISHED";
  }
  if (event === "match_status_cancelled") {
    return "CANCELLED";
  }
  if (event === "match_status_aborted") {
    return "CANCELLED";
  }
  return "UNKNOWN";
}

export async function persistFaceitWebhook(
  body: FaceitWebhookBody
): Promise<void> {
  const update = extractFaceitWebhookMatchUpdate(body);
  const supabase = createServerSupabase();

  if (update.shouldActivate && update.matchId && update.playerIds.length > 0) {
    const rows = update.playerIds.map((playerId) => ({
      player_faceit_id: playerId,
      player_nickname: getTrackedNickname(playerId),
      current_match_id: update.matchId,
      match_status: getPersistedStatus(update.event),
      source_event: update.event,
      payload: body,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from("faceit_webhook_live_state").upsert(rows, {
      onConflict: "player_faceit_id",
    });
    return;
  }

  if (update.shouldClear) {
    const clearPayload = {
      current_match_id: null,
      match_status: getPersistedStatus(update.event),
      source_event: update.event,
      payload: body,
      updated_at: new Date().toISOString(),
    };

    if (update.matchId) {
      await supabase
        .from("faceit_webhook_live_state")
        .update(clearPayload)
        .eq("current_match_id", update.matchId);
    }

    if (update.playerIds.length > 0) {
      await supabase.from("faceit_webhook_live_state").upsert(
        update.playerIds.map((playerId) => ({
          player_faceit_id: playerId,
          player_nickname: getTrackedNickname(playerId),
          ...clearPayload,
        })),
        { onConflict: "player_faceit_id" }
      );
    }
  }
}

export async function getWebhookLiveMatchMap(
  playerIds: string[]
): Promise<Map<string, string[]>> {
  if (playerIds.length === 0) {
    return new Map();
  }

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("faceit_webhook_live_state")
    .select("player_faceit_id,current_match_id")
    .in("player_faceit_id", playerIds)
    .not("current_match_id", "is", null);

  return groupWebhookStateByMatch(
    (data ?? []) as {
      player_faceit_id: string;
      current_match_id: string | null;
    }[]
  );
}
