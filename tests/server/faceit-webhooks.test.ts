import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getWebhookLiveMatchMap,
  persistFaceitWebhook,
} from "~/server/faceit-webhooks";

const TRACKED_WEBHOOK_PLAYERS = {
  soavarice: {
    faceitId: "15844c99-d26e-419e-bd14-30908f502c03",
  },
  f1aw1esss: {
    faceitId: "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
  },
  tibabg: {
    faceitId: "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
  },
} as const;

const mockSupabase = vi.hoisted(() => {
  const stateRows = [
    {
      player_faceit_id: "15844c99-d26e-419e-bd14-30908f502c03",
      current_match_id: "match-1",
    },
    {
      player_faceit_id: "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
      current_match_id: "match-1",
    },
    {
      player_faceit_id: "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
      current_match_id: null,
    },
  ];
  let trackedFriendRows = [
    {
      faceit_id: "15844c99-d26e-419e-bd14-30908f502c03",
      nickname: "soavarice",
    },
    {
      faceit_id: "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
      nickname: "TibaBG",
    },
    {
      faceit_id: "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
      nickname: "F1aw1esss",
    },
  ];

  const upsert = vi.fn(async () => ({ data: null, error: null }));
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: null, error: null })),
  }));

  const selectChain = {
    in: vi.fn(() => ({
      not: vi.fn(async () => ({ data: stateRows })),
    })),
  };

  const from = vi.fn((table: string) => {
    if (table === "faceit_webhook_live_state") {
      return {
        upsert,
        update,
        select: vi.fn(() => selectChain),
      };
    }

    if (table === "tracked_friends") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: trackedFriendRows })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    from,
    upsert,
    update,
    selectChain,
    setTrackedFriendRows(
      value: Array<{ faceit_id: string; nickname: string }>
    ) {
      trackedFriendRows = value;
    },
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => mockSupabase.supabase,
}));

afterEach(() => {
  vi.clearAllMocks();
  mockSupabase.setTrackedFriendRows([
    {
      faceit_id: "15844c99-d26e-419e-bd14-30908f502c03",
      nickname: "soavarice",
    },
    {
      faceit_id: "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
      nickname: "TibaBG",
    },
    {
      faceit_id: "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
      nickname: "F1aw1esss",
    },
  ]);
});

describe("persistFaceitWebhook", () => {
  it("persists configuring status for match creation events", async () => {
    const body = {
      event: "match_object_created",
      payload: {
        match_id: "match-configuring",
        teams: {
          faction1: {
            roster: [{ player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId }],
          },
        },
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
          match_status: "CONFIGURING",
          current_match_id: "match-configuring",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("upserts live state rows for tracked players when a match activates", async () => {
    const body = {
      event: "match_status_ready",
      payload: {
        match_id: "match-42",
        teams: {
          faction1: {
            roster: [{ player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId }],
          },
          faction2: {
            roster: [{ player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId }],
          },
        },
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
          player_nickname: "soavarice",
          current_match_id: "match-42",
          match_status: "READY",
          source_event: "match_status_ready",
          payload: body,
        }),
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
          player_nickname: "TibaBG",
          current_match_id: "match-42",
        }),
      ]),
      { onConflict: "player_faceit_id" }
    );
  });

  it("clears persisted match state for terminal events", async () => {
    const eq = vi.fn(async () => ({ data: null, error: null }));
    mockSupabase.update.mockReturnValueOnce({ eq });

    const body = {
      event: "match_status_finished",
      payload: {
        match_id: "match-42",
        players: [{ player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId }],
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_match_id: null,
        match_status: "FINISHED",
        source_event: "match_status_finished",
        payload: body,
      })
    );
    expect(eq).toHaveBeenCalledWith("current_match_id", "match-42");
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
          current_match_id: null,
          match_status: "FINISHED",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("marks cancelled events as cancelled without requiring a match id", async () => {
    const body = {
      event: "match_status_cancelled",
      payload: {
        players: [{ player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId }],
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
          current_match_id: null,
          match_status: "CANCELLED",
          source_event: "match_status_cancelled",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("marks aborted events as cancelled", async () => {
    const body = {
      event: "match_status_aborted",
      payload: {
        players: [{ player_id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId }],
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
          current_match_id: null,
          match_status: "CANCELLED",
          source_event: "match_status_aborted",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });

  it("ignores unsupported events", async () => {
    await persistFaceitWebhook({
      event: "unknown_event",
      payload: {
        match_id: "ignored-match",
        players: [{ player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId }],
      },
    });

    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });

  it("uses active tracked friends from the database instead of a hardcoded list", async () => {
    mockSupabase.setTrackedFriendRows([
      {
        faceit_id: "db-only-player",
        nickname: "DbOnly",
      },
    ]);

    const body = {
      event: "match_status_ready",
      payload: {
        match_id: "match-db-only",
        players: [{ player_id: "db-only-player" }],
      },
    };

    await persistFaceitWebhook(body);

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_faceit_id: "db-only-player",
          player_nickname: "DbOnly",
          current_match_id: "match-db-only",
          match_status: "READY",
        }),
      ],
      { onConflict: "player_faceit_id" }
    );
  });
});

describe("getWebhookLiveMatchMap", () => {
  it("returns an empty map without querying when no player ids are provided", async () => {
    const result = await getWebhookLiveMatchMap([]);

    expect(result).toEqual(new Map());
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns grouped active match ids for the requested players", async () => {
    const result = await getWebhookLiveMatchMap([
      TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
      TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
      TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
    ]);

    expect(mockSupabase.selectChain.in).toHaveBeenCalledWith(
      "player_faceit_id",
      [
        TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
        TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
        TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
      ]
    );
    expect(result).toEqual(
      new Map([
        [
          "match-1",
          [
            TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
            TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
          ],
        ],
      ])
    );
  });
});
