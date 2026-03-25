import { afterEach, describe, expect, it, vi } from "vitest";

const extractionMocks = vi.hoisted(() => ({
  extractFaceitWebhookMatchUpdate: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const upsert = vi.fn(async () => ({ data: null, error: null }));
  let selectData: Array<{
    player_faceit_id: string;
    current_match_id: string | null;
  }> | null = [];

  return {
    supabase: {
      from: vi.fn(() => ({
        upsert,
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            not: vi.fn(async () => ({ data: selectData })),
          })),
        })),
      })),
    },
    upsert,
    setSelectData(
      value: Array<{
        player_faceit_id: string;
        current_match_id: string | null;
      }> | null
    ) {
      selectData = value;
    },
  };
});

vi.mock("~/lib/faceit-webhooks", async () => {
  const actual = await vi.importActual<typeof import("~/lib/faceit-webhooks")>(
    "~/lib/faceit-webhooks"
  );
  return {
    ...actual,
    extractFaceitWebhookMatchUpdate:
      extractionMocks.extractFaceitWebhookMatchUpdate,
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => supabaseMocks.supabase,
}));

import { TRACKED_WEBHOOK_PLAYERS } from "~/lib/faceit-webhooks";
import {
  getWebhookLiveMatchMap,
  persistFaceitWebhook,
} from "~/server/faceit-webhooks";

afterEach(() => {
  vi.clearAllMocks();
  supabaseMocks.setSelectData([]);
});

describe("persistFaceitWebhook status mapping", () => {
  it("stores UNKNOWN when extraction activates an unsupported event name", async () => {
    extractionMocks.extractFaceitWebhookMatchUpdate.mockReturnValue({
      event: "match_status_mystery",
      matchId: "mystery-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId],
      shouldActivate: true,
      shouldClear: false,
    });

    await persistFaceitWebhook({ payload: {} });

    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
          current_match_id: "mystery-match",
          match_status: "UNKNOWN",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("falls back to the raw faceit id when the player is not tracked", async () => {
    extractionMocks.extractFaceitWebhookMatchUpdate.mockReturnValue({
      event: "match_status_mystery",
      matchId: "mystery-match",
      playerIds: ["untracked-player"],
      shouldActivate: true,
      shouldClear: false,
    });

    await persistFaceitWebhook({ payload: {} });

    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: "untracked-player",
          player_nickname: "untracked-player",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("clears by match id without upserting when no tracked players are present", async () => {
    extractionMocks.extractFaceitWebhookMatchUpdate.mockReturnValue({
      event: "match_status_finished",
      matchId: "finished-match",
      playerIds: [],
      shouldActivate: false,
      shouldClear: true,
    });

    await persistFaceitWebhook({ payload: {} });

    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
  });

  it("treats null database rows as an empty webhook live match map", async () => {
    supabaseMocks.setSelectData(null);

    await expect(getWebhookLiveMatchMap(["player-1"])).resolves.toEqual(
      new Map()
    );
  });
});
