import { getSessionBanterLine } from "~/lib/banter";
import {
  computeImpactScore,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";
import type {
  AggregatePlayerStats,
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  MapStats,
  MatchPlayerStats,
  PlayerHistoryMatch,
  SessionAward,
} from "~/lib/types";

export const MAP_COLORS: Record<string, string> = {
  de_inferno: "bg-[#cc9944]",
  de_dust2: "bg-[#ccaa88]",
  de_nuke: "bg-[#44aacc]",
  de_ancient: "bg-[#55aa77]",
  de_mirage: "bg-[#aa77cc]",
  de_anubis: "bg-[#77aa55]",
  de_vertigo: "bg-[#55aacc]",
};

export function mapDisplayName(map: string): string {
  return map.replace("de_", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function computeAggregateStats(params: {
  matchIds: string[];
  matchStats: Record<string, MatchPlayerStats[]>;
  partyMemberIds: string[];
  demoMatches: Record<string, DemoMatchAnalytics>;
  allHaveDemo: boolean;
  eloMap?: Record<string, number>;
}): Record<string, AggregatePlayerStats> {
  const {
    matchIds,
    matchStats,
    partyMemberIds,
    demoMatches,
    allHaveDemo,
    eloMap = {},
  } = params;
  const result: Record<string, AggregatePlayerStats> = {};

  for (const pid of partyMemberIds) {
    const playerMatches: MatchPlayerStats[] = [];
    const playerDemoStats: DemoPlayerAnalytics[] = [];

    for (const matchId of matchIds) {
      const players = matchStats[matchId] ?? [];
      const p = players.find((pl) => pl.playerId === pid);
      if (p) {
        playerMatches.push(p);
      }
      if (allHaveDemo && demoMatches[matchId]) {
        const dp = demoMatches[matchId].players.find(
          (pl) =>
            pl.playerId === pid ||
            pl.nickname.toLowerCase() === p?.nickname.toLowerCase()
        );
        if (dp) {
          playerDemoStats.push(dp);
        }
      }
    }

    if (playerMatches.length === 0) {
      continue;
    }

    const n = playerMatches.length;
    const nickname = playerMatches[0].nickname;

    const elo = eloMap[pid] ?? 1225;
    const impactScores = playerMatches.map((m) => {
      const row: SharedStatsLeaderboardRow = {
        matchId: "",
        playedAt: null,
        faceitId: pid,
        nickname: m.nickname,
        elo,
        kills: m.kills,
        kdRatio: m.kdRatio,
        adr: m.adr,
        hsPercent: m.hsPercent,
        krRatio: m.krRatio,
        win: m.result,
        firstKills: m.firstKills,
        clutchKills: m.clutchKills,
        utilityDamage: m.utilityDamage,
        enemiesFlashed: m.enemiesFlashed,
        entryCount: m.entryCount,
        entryWins: m.entryWins,
        sniperKills: m.sniperKills,
      };
      return computeImpactScore(row);
    });

    const base: AggregatePlayerStats = {
      faceitId: pid,
      nickname,
      gamesPlayed: n,
      wins: playerMatches.filter((m) => m.result).length,
      avgImpact:
        Math.round(
          (impactScores.reduce((s, v) => s + v, 0) / impactScores.length) * 10
        ) / 10,
      avgKd: playerMatches.reduce((s, m) => s + m.kdRatio, 0) / n,
      avgAdr: playerMatches.reduce((s, m) => s + m.adr, 0) / n,
      avgHsPercent: playerMatches.reduce((s, m) => s + m.hsPercent, 0) / n,
      avgKrRatio: playerMatches.reduce((s, m) => s + m.krRatio, 0) / n,
      totalMvps: playerMatches.reduce((s, m) => s + m.mvps, 0),
      totalTripleKills: playerMatches.reduce((s, m) => s + m.tripleKills, 0),
      totalQuadroKills: playerMatches.reduce((s, m) => s + m.quadroKills, 0),
      totalPentaKills: playerMatches.reduce((s, m) => s + m.pentaKills, 0),
    };

    if (allHaveDemo && playerDemoStats.length > 0) {
      const dn = playerDemoStats.length;
      base.avgRating =
        playerDemoStats.reduce((s, d) => s + (d.rating ?? 0), 0) / dn;
      base.avgRws = playerDemoStats.reduce((s, d) => s + d.rws, 0) / dn;
      base.avgKast =
        playerDemoStats.reduce((s, d) => s + (d.kastPercent ?? 0), 0) / dn;
      base.avgTradeKills =
        playerDemoStats.reduce((s, d) => s + d.tradeKills, 0) / dn;
      base.avgUtilityDamage =
        playerDemoStats.reduce((s, d) => s + (d.utilityDamage ?? 0), 0) / dn;
      base.avgEntryRate =
        playerDemoStats.reduce((s, d) => {
          const attempts = d.openingDuelAttempts ?? 0;
          const wins = d.openingDuelWins ?? 0;
          return s + (attempts > 0 ? wins / attempts : 0);
        }, 0) / dn;
      base.avgEnemiesFlashed =
        playerDemoStats.reduce((s, d) => s + (d.enemiesFlashed ?? 0), 0) / dn;
      base.avgEconomyEfficiency =
        playerDemoStats.reduce((s, d) => s + (d.economyEfficiency ?? 0), 0) /
        dn;
      base.totalClutchWins = playerDemoStats.reduce(
        (s, d) => s + (d.clutchWins ?? 0),
        0
      );
    }

    result[pid] = base;
  }

  return result;
}

export function computeAwards(params: {
  aggregateStats: Record<string, AggregatePlayerStats>;
  allHaveDemo: boolean;
  mapDistribution: MapStats[];
  playerId: string;
  date: string;
}): SessionAward[] {
  const { aggregateStats, allHaveDemo, mapDistribution, playerId, date } =
    params;
  const entries = Object.values(aggregateStats).sort((a, b) =>
    a.nickname.localeCompare(b.nickname)
  );
  if (entries.length === 0) {
    return [];
  }

  const awards: SessionAward[] = [];

  const pickBest = (fn: (e: AggregatePlayerStats) => number) =>
    entries.reduce((best, e) => (fn(e) > fn(best) ? e : best), entries[0]);
  const pickWorst = (fn: (e: AggregatePlayerStats) => number) =>
    entries.reduce((worst, e) => (fn(e) < fn(worst) ? e : worst), entries[0]);

  const mvpMetric = allHaveDemo
    ? (e: AggregatePlayerStats) => e.avgRating ?? 0
    : (e: AggregatePlayerStats) => e.avgKd;
  const mvp = pickBest(mvpMetric);
  awards.push({
    id: "party-mvp",
    title: "Party MVP",
    recipient: mvp.nickname,
    value: allHaveDemo
      ? `${(mvp.avgRating ?? 0).toFixed(2)} Rating`
      : `${mvp.avgKd.toFixed(2)} K/D`,
    banter: getSessionBanterLine("carry", mvp.nickname, playerId, date),
    requiresDemo: false,
  });

  if (entries.length >= 2) {
    const anchor = pickWorst(mvpMetric);
    awards.push({
      id: "party-anchor",
      title: "Party Anchor",
      recipient: anchor.nickname,
      value: allHaveDemo
        ? `${(anchor.avgRating ?? 0).toFixed(2)} Rating`
        : `${anchor.avgKd.toFixed(2)} K/D`,
      banter: getSessionBanterLine("roast", anchor.nickname, playerId, date),
      requiresDemo: false,
    });
  }

  const hsMachine = pickBest((e) => e.avgHsPercent);
  awards.push({
    id: "headshot-machine",
    title: "Headshot Machine",
    recipient: hsMachine.nickname,
    value: `${Math.round(hsMachine.avgHsPercent)}% HS`,
    requiresDemo: false,
  });

  const dmgDealer = pickBest((e) => e.avgAdr);
  awards.push({
    id: "damage-dealer",
    title: "Damage Dealer",
    recipient: dmgDealer.nickname,
    value: `${Math.round(dmgDealer.avgAdr)} ADR`,
    requiresDemo: false,
  });

  const uniqueMaps = mapDistribution.filter((m) => m.gamesPlayed > 0);
  if (uniqueMaps.length >= 2) {
    const best = uniqueMaps.reduce(
      (a, b) => (a.winRate > b.winRate ? a : b),
      uniqueMaps[0]
    );
    if (best.winRate > 0) {
      awards.push({
        id: "map-specialist",
        title: "Map Specialist",
        recipient: best.map,
        value: `${Math.round(best.winRate)}% WR (${best.wins}W-${best.losses}L)`,
        requiresDemo: false,
      });
    }
  }

  if (allHaveDemo) {
    const entryKing = pickBest((e) => e.avgEntryRate ?? 0);
    awards.push({
      id: "entry-king",
      title: "Entry King",
      recipient: entryKing.nickname,
      value: `${((entryKing.avgEntryRate ?? 0) * 100).toFixed(0)}% Entry`,
      requiresDemo: true,
    });

    const utilLord = pickBest((e) => e.avgUtilityDamage ?? 0);
    awards.push({
      id: "utility-lord",
      title: "Utility Lord",
      recipient: utilLord.nickname,
      value: `${Math.round(utilLord.avgUtilityDamage ?? 0)} UD`,
      requiresDemo: true,
    });

    const tradeMaster = pickBest((e) => e.avgTradeKills ?? 0);
    awards.push({
      id: "trade-master",
      title: "Trade Master",
      recipient: tradeMaster.nickname,
      value: `${(tradeMaster.avgTradeKills ?? 0).toFixed(1)} TK`,
      requiresDemo: true,
    });

    const clutchGod = pickBest((e) => e.totalClutchWins ?? 0);
    awards.push({
      id: "clutch-god",
      title: "Clutch God",
      recipient: clutchGod.nickname,
      value: `${clutchGod.totalClutchWins ?? 0} Clutches`,
      requiresDemo: true,
    });

    const flashDemon = pickBest((e) => e.avgEnemiesFlashed ?? 0);
    awards.push({
      id: "flash-demon",
      title: "Flash Demon",
      recipient: flashDemon.nickname,
      value: `${(flashDemon.avgEnemiesFlashed ?? 0).toFixed(1)} Flashed`,
      requiresDemo: true,
    });

    const econKing = pickBest((e) => e.avgEconomyEfficiency ?? 0);
    awards.push({
      id: "economy-king",
      title: "Economy King",
      recipient: econKing.nickname,
      value: `${(econKing.avgEconomyEfficiency ?? 0).toFixed(1)} DMG/$1K`,
      requiresDemo: true,
    });
  }

  return awards;
}

export function computeMapDistribution(
  matches: Pick<PlayerHistoryMatch, "map" | "result">[]
): MapStats[] {
  const mapData = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    const existing = mapData.get(m.map) ?? { wins: 0, losses: 0 };
    if (m.result) {
      existing.wins++;
    } else {
      existing.losses++;
    }
    mapData.set(m.map, existing);
  }

  return [...mapData.entries()]
    .map(([map, { wins, losses }]) => ({
      map,
      gamesPlayed: wins + losses,
      wins,
      losses,
      winRate: Math.round((wins / (wins + losses)) * 100),
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}

export function computeSessionStreak(
  matches: Pick<PlayerHistoryMatch, "result" | "startedAt">[]
): { type: "win" | "loss"; count: number } {
  const sorted = [...matches].sort((a, b) => a.startedAt - b.startedAt);
  if (sorted.length === 0) {
    return { type: "win", count: 0 };
  }

  let maxStreak: { type: "win" | "loss"; count: number } = {
    type: "win",
    count: 0,
  };
  let current: { type: "win" | "loss"; count: number } = {
    type: sorted[0].result ? "win" : "loss",
    count: 1,
  };

  for (let i = 1; i < sorted.length; i++) {
    const isWin = sorted[i].result;
    if (
      (isWin && current.type === "win") ||
      (!isWin && current.type === "loss")
    ) {
      current.count++;
    } else {
      if (current.count > maxStreak.count) {
        maxStreak = { ...current };
      }
      current = { type: isWin ? "win" : "loss", count: 1 };
    }
  }
  if (current.count > maxStreak.count) {
    maxStreak = current;
  }

  return maxStreak;
}
