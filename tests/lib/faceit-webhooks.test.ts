import { describe, expect, it } from "vitest";
import {
  extractFaceitWebhookMatchUpdate,
  groupWebhookStateByMatch,
  TRACKED_WEBHOOK_PLAYERS,
} from "~/lib/faceit-webhooks";

describe("extractFaceitWebhookMatchUpdate", () => {
  it("extracts a live match update from a FACEIT match payload response", () => {
    const result = extractFaceitWebhookMatchUpdate({
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
    });

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
    const result = extractFaceitWebhookMatchUpdate({
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
    });

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
    const result = extractFaceitWebhookMatchUpdate({
      event: "match_status_finished",
      payload: {
        match_id: "1-finished-match",
        players: [
          { player_id: TRACKED_WEBHOOK_PLAYERS.tibabg.faceitId },
        ],
      },
    });

    expect(result).toEqual({
      event: "match_status_finished",
      matchId: "1-finished-match",
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
