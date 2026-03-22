import { describe, expect, it } from "vitest";
import {
  getFriendScoreboardPlayers,
  getLiveMatchDisplayScore,
  getLiveMatchTeamLabels,
} from "~/lib/live-match";
import type { LiveMatch, MatchDetail, MatchPlayerStats } from "~/lib/types";

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

describe("getLiveMatchDisplayScore", () => {
  it("prefers live match detail scores when they are available", () => {
    const match: LiveMatch = {
      matchId: "m1",
      status: "ONGOING",
      map: "de_dust2",
      score: { faction1: 5, faction2: 3 },
      startedAt: 0,
      friendFaction: "faction1",
      friendIds: ["friend-1"],
      teams: {
        faction1: {
          teamId: "team-1",
          name: "Team 1",
          roster: [],
        },
        faction2: {
          teamId: "team-2",
          name: "Team 2",
          roster: [],
        },
      },
    };

    const detail: MatchDetail = {
      matchId: "m1",
      map: "de_dust2",
      score: "9 / 6",
      status: "ONGOING",
      startedAt: 0,
      finishedAt: null,
      players: [],
      demoUrl: null,
      teams: {
        faction1: { name: "Team 1", score: 9, playerIds: [] },
        faction2: { name: "Team 2", score: 6, playerIds: [] },
      },
      rounds: 15,
      region: "EU",
      competitionName: "Ranked",
    };

    expect(getLiveMatchDisplayScore(match, detail)).toEqual({ faction1: 9, faction2: 6 });
  });
});

describe("getFriendScoreboardPlayers", () => {
  it("keeps only friend players and sorts them by kills descending", () => {
    const makePlayer = (
      playerId: string,
      nickname: string,
      kills: number
    ): MatchPlayerStats => ({
      playerId,
      nickname,
      kills,
      deaths: 0,
      assists: 0,
      headshots: 0,
      mvps: 0,
      kdRatio: 0,
      adr: 0,
      hsPercent: 0,
      krRatio: 0,
      tripleKills: 0,
      quadroKills: 0,
      pentaKills: 0,
      result: false,
      damage: 0,
      firstKills: 0,
      entryCount: 0,
      entryWins: 0,
      clutchKills: 0,
      oneV1Count: 0,
      oneV1Wins: 0,
      oneV2Count: 0,
      oneV2Wins: 0,
      doubleKills: 0,
      utilityDamage: 0,
      enemiesFlashed: 0,
      flashCount: 0,
      sniperKills: 0,
      pistolKills: 0,
    });

    const result = getFriendScoreboardPlayers(
      [
        makePlayer("enemy-1", "Enemy", 22),
        makePlayer("friend-1", "FriendOne", 17),
        makePlayer("friend-2", "FriendTwo", 24),
      ],
      ["friend-1", "friend-2"]
    );

    expect(result.map((player) => player.playerId)).toEqual(["friend-2", "friend-1"]);
  });
});
