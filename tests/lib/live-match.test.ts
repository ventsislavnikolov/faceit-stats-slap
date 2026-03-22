import { describe, expect, it } from "vitest";
import { getLiveMatchTeamLabels } from "~/lib/live-match";
import type { LiveMatch } from "~/lib/types";

describe("getLiveMatchTeamLabels", () => {
  it("uses friend names instead of raw team ids", () => {
    const match: LiveMatch = {
      matchId: "m1",
      status: "ONGOING",
      map: "de_dust2",
      score: { faction1: 5, faction2: 3 },
      startedAt: 0,
      friendFaction: "faction1",
      friendIds: ["friend-1", "friend-2"],
      teams: {
        faction1: {
          teamId: "ecfa7489-28c0-453a-9918-851f57bd2622",
          name: "ecfa7489-28c0-453a-9918-851f57bd2622",
          roster: [
            { playerId: "friend-1", nickname: "TibaBG", avatar: "", skillLevel: 10 },
            { playerId: "friend-2", nickname: "Rebo0unD", avatar: "", skillLevel: 10 },
          ],
        },
        faction2: {
          teamId: "a201078d-454e-4f29-a919-3a9f93d63126",
          name: "a201078d-454e-4f29-a919-3a9f93d63126",
          roster: [
            { playerId: "enemy-1", nickname: "EnemyOne", avatar: "", skillLevel: 10 },
          ],
        },
      },
    };

    expect(getLiveMatchTeamLabels(match)).toEqual({
      faction1: "TibaBG +1",
      faction2: "Opponents",
    });
  });
});
