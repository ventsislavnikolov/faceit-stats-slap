import type { DemoTeamKey } from "~/lib/types";

export const DEFAULT_TRADE_WINDOW_SECONDS = 5;
export const RWS_BOMB_BONUS_POINTS = 30;
export const RWS_EQUAL_SHARE_FALLBACK_TEAM_SIZE = 5;

type RoundWinner = DemoTeamKey | null;

type TradeKillInput = {
  killerTeamKey: DemoTeamKey;
  victimTeamKey: DemoTeamKey;
  killAtSeconds: number;
  victimDeathAtSeconds: number;
  tradeWindowSeconds?: number;
};

type ExitKillInput = {
  killerTeamKey: DemoTeamKey;
  victimTeamKey: DemoTeamKey;
  killAtSeconds: number;
  bombPlantedAtSeconds: number | null;
  roundEndedAtSeconds: number;
};

type RoundPlayerInput = {
  playerId: string;
  teamKey: DemoTeamKey;
  damage: number;
  alive: boolean;
};

type ComputeRwsForRoundInput = {
  winningTeamKey: DemoTeamKey | null;
  bombBonusPlayerId?: string | null;
  players: readonly RoundPlayerInput[];
};

type StreakSummary = {
  longestWinStreak: number;
  longestLossStreak: number;
  currentWinStreak: number;
  currentLossStreak: number;
};

export function classifyTradeKill(input: TradeKillInput): boolean {
  if (input.killerTeamKey === input.victimTeamKey) {
    return false;
  }

  if (input.killAtSeconds < input.victimDeathAtSeconds) {
    return false;
  }

  const tradeWindowSeconds =
    input.tradeWindowSeconds ?? DEFAULT_TRADE_WINDOW_SECONDS;

  return input.killAtSeconds - input.victimDeathAtSeconds <= tradeWindowSeconds;
}

export function classifyExitKill(input: ExitKillInput): boolean {
  return (
    input.bombPlantedAtSeconds !== null &&
    input.killerTeamKey !== input.victimTeamKey &&
    input.killAtSeconds >= input.bombPlantedAtSeconds &&
    input.killAtSeconds <= input.roundEndedAtSeconds
  );
}

export function buildRoundScoreProgression(
  roundWinners: readonly RoundWinner[]
) {
  let team1Score = 0;
  let team2Score = 0;

  return roundWinners.map((winnerTeamKey, index) => {
    if (winnerTeamKey === "team1") {
      team1Score += 1;
    } else if (winnerTeamKey === "team2") {
      team2Score += 1;
    }

    return {
      roundNumber: index + 1,
      winnerTeamKey,
      scoreAfterRound: {
        team1: team1Score,
        team2: team2Score,
      },
    };
  });
}

function buildStreakSummaryForTeam(
  roundWinners: readonly RoundWinner[],
  teamKey: DemoTeamKey
): StreakSummary {
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const winnerTeamKey of roundWinners) {
    if (winnerTeamKey === teamKey) {
      currentWinStreak += 1;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      continue;
    }

    if (winnerTeamKey === null) {
      continue;
    }

    currentLossStreak += 1;
    currentWinStreak = 0;
    longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
  }

  return {
    longestWinStreak,
    longestLossStreak,
    currentWinStreak,
    currentLossStreak,
  };
}

export function buildWinLossStreaks(roundWinners: readonly RoundWinner[]) {
  return {
    team1: buildStreakSummaryForTeam(roundWinners, "team1"),
    team2: buildStreakSummaryForTeam(roundWinners, "team2"),
  };
}

export function computeRwsForRound(input: ComputeRwsForRoundInput) {
  const result: Record<string, number> = {};

  for (const player of input.players) {
    result[player.playerId] = 0;
  }

  if (input.winningTeamKey === null) {
    return result;
  }

  const winningPlayers = input.players.filter(
    (player) => player.teamKey === input.winningTeamKey
  );
  const aliveWinningPlayers = winningPlayers.filter((player) => player.alive);
  const totalWinningDamage = winningPlayers.reduce(
    (sum, player) => sum + player.damage,
    0
  );
  const hasBombBonusPlayer =
    input.bombBonusPlayerId !== undefined &&
    input.bombBonusPlayerId !== null &&
    winningPlayers.some(
      (player) => player.playerId === input.bombBonusPlayerId
    );

  const roundValue = hasBombBonusPlayer ? 100 - RWS_BOMB_BONUS_POINTS : 100;

  // Eligibility rule:
  // - Dead winners are ineligible for RWS, so their final value stays 0.
  // - Their damage still contributes to the winning-team damage pool.
  // - If no one on the winning team survived, fall back to an explicit equal split
  //   across the full winning roster so the round value is preserved.
  if (aliveWinningPlayers.length === 0) {
    const fallbackTeamSize =
      winningPlayers.length || RWS_EQUAL_SHARE_FALLBACK_TEAM_SIZE;
    const equalShare = roundValue / fallbackTeamSize;

    for (const player of winningPlayers) {
      result[player.playerId] = equalShare;
    }
  } else if (totalWinningDamage > 0) {
    const baseShares = winningPlayers.map((player) => ({
      playerId: player.playerId,
      alive: player.alive,
      baseShare: (player.damage / totalWinningDamage) * roundValue,
    }));
    const eligibleBaseShare = baseShares
      .filter((share) => share.alive)
      .reduce((sum, share) => sum + share.baseShare, 0);
    const ineligibleBaseShare = roundValue - eligibleBaseShare;

    if (eligibleBaseShare > 0) {
      for (const share of baseShares) {
        if (!share.alive) {
          continue;
        }

        const redistributedShare =
          (share.baseShare / eligibleBaseShare) * ineligibleBaseShare;
        result[share.playerId] = share.baseShare + redistributedShare;
      }
    } else {
      const equalShare = roundValue / aliveWinningPlayers.length;

      for (const player of aliveWinningPlayers) {
        result[player.playerId] = equalShare;
      }
    }
  } else {
    const equalShare = roundValue / aliveWinningPlayers.length;

    for (const player of aliveWinningPlayers) {
      result[player.playerId] = equalShare;
    }
  }

  if (hasBombBonusPlayer && input.bombBonusPlayerId) {
    result[input.bombBonusPlayerId] += RWS_BOMB_BONUS_POINTS;
  }

  return result;
}
