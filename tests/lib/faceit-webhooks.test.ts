import { describe, expect, it } from "vitest";
import {
  extractFaceitWebhookMatchUpdate,
  groupWebhookStateByMatch,
} from "~/lib/faceit-webhooks";

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

const trackedPlayerIds = Object.values(TRACKED_WEBHOOK_PLAYERS).map(
  (player) => player.faceitId
);

describe("extractFaceitWebhookMatchUpdate", () => {
  it("extracts a live match update from a FACEIT match payload response", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          id: "1-b9715630-add8-430d-a78a-1686e5b0e817",
          state: "ONGOING",
          status: "LIVE",
          teams: {
            faction1: {
              roster: [{ id: "someone-else" }],
            },
            faction2: {
              roster: [
                { id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId },
                { id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId },
              ],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_ready",
      matchId: "1-b9715630-add8-430d-a78a-1686e5b0e817",
      playerIds: [
        TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
        TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
      ],
      shouldActivate: true,
      shouldClear: false,
    });
  });

  it("extracts an active match update for tracked players from roster payloads", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        event: "match_status_ready",
        payload: {
          match_id: "1-live-match",
          teams: {
            faction1: {
              roster: [
                { player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId },
                { player_id: "someone-else" },
              ],
            },
            faction2: {
              roster: [
                { player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId },
                { player_id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId },
              ],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_ready",
      matchId: "1-live-match",
      playerIds: [
        TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
        TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
        TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
      ],
      shouldActivate: true,
      shouldClear: false,
    });
  });

  it("marks terminal events as clearing updates", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        event: "match_status_finished",
        payload: {
          match_id: "1-finished-match",
          players: [{ player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId }],
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_finished",
      matchId: "1-finished-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId],
      shouldActivate: false,
      shouldClear: true,
    });
  });

  it("derives configuring events from payload-only match objects", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          id: "1-configuring-match",
          state: "CONFIGURING",
          teams: {
            faction1: {
              roster: [
                { faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId },
              ],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_configuring",
      matchId: "1-configuring-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId],
      shouldActivate: true,
      shouldClear: false,
    });
  });

  it("extracts match ids from nested payload arrays when the event is provided", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        event: "match_status_finished",
        payload: [
          {
            object: {
              id: "1-finished-match",
              teams: {
                faction1: {
                  roster: [
                    { player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId },
                  ],
                },
              },
            },
          },
        ],
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_finished",
      matchId: "1-finished-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId],
      shouldActivate: false,
      shouldClear: true,
    });
  });

  it("derives cancelled events from payload-only match objects", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          id: "1-cancelled-match",
          state: "CANCELLED",
          teams: {
            faction1: {
              roster: [
                { player_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId },
              ],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_cancelled",
      matchId: "1-cancelled-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId],
      shouldActivate: false,
      shouldClear: true,
    });
  });

  it("derives aborted events from payload-only match objects", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          id: "1-aborted-match",
          state: "ABORTED",
          teams: {
            faction1: {
              roster: [
                { player_id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId },
              ],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_aborted",
      matchId: "1-aborted-match",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId],
      shouldActivate: false,
      shouldClear: true,
    });
  });

  it("returns unknown when no event or tracked players can be extracted", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          object: {
            state: "PAUSED",
            teams: {
              faction1: {
                roster: [{ player_id: "someone-else" }],
              },
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "unknown",
      matchId: null,
      playerIds: [],
      shouldActivate: false,
      shouldClear: false,
    });
  });

  it("returns a null match id when nested arrays do not contain a match object", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        event: "match_status_ready",
        payload: [{ object: { teams: [] } }],
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_ready",
      matchId: null,
      playerIds: [],
      shouldActivate: true,
      shouldClear: false,
    });
  });

  it("derives finished events from payload-only match objects", () => {
    const result = extractFaceitWebhookMatchUpdate(
      {
        payload: {
          id: "1-finished-direct",
          state: "FINISHED",
          teams: {
            faction1: {
              roster: [{ player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId }],
            },
          },
        },
      },
      trackedPlayerIds
    );

    expect(result).toEqual({
      event: "match_status_finished",
      matchId: "1-finished-direct",
      playerIds: [TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId],
      shouldActivate: false,
      shouldClear: true,
    });
  });
});

describe("groupWebhookStateByMatch", () => {
  it("groups tracked live state rows by active match id", () => {
    const result = groupWebhookStateByMatch([
      {
        player_faceit_id: TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
        current_match_id: "1-live-match",
      },
      {
        player_faceit_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
        current_match_id: "1-live-match",
      },
      {
        player_faceit_id: TRACKED_WEBHOOK_PLAYERS.f1aw1esss.faceitId,
        current_match_id: null,
      },
    ]);

    expect(result).toEqual(
      new Map([
        [
          "1-live-match",
          [
            TRACKED_WEBHOOK_PLAYERS.soavarice.faceitId,
            TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId,
          ],
        ],
      ])
    );
  });
});
