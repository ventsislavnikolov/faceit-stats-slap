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
  SessionPodiumEntry,
  SessionRivalryCard,
  SessionRivalryData,
  SessionScoreBreakdown,
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

type SessionCategoryDefinition = {
  key: keyof AggregatePlayerStats | "winRate";
  label: string;
  weight: number;
  read: (stats: AggregatePlayerStats) => number;
};

type PairSummary = {
  faceitIdA: string;
  faceitIdB: string;
  nicknameA: string;
  nicknameB: string;
  sharedMaps: number;
  winsA: number;
  winsB: number;
  totalMargin: number;
};

const SAFE_CATEGORIES: SessionCategoryDefinition[] = [
  {
    key: "avgImpact",
    label: "Impact",
    weight: 4,
    read: (stats) => stats.avgImpact,
  },
  {
    key: "avgKd",
    label: "K/D",
    weight: 3,
    read: (stats) => stats.avgKd,
  },
  {
    key: "avgAdr",
    label: "ADR",
    weight: 3,
    read: (stats) => stats.avgAdr,
  },
  {
    key: "avgHsPercent",
    label: "HS%",
    weight: 2,
    read: (stats) => stats.avgHsPercent,
  },
  {
    key: "winRate",
    label: "Win rate",
    weight: 4,
    read: (stats) =>
      stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0,
  },
];

const DEMO_CATEGORIES: SessionCategoryDefinition[] = [
  {
    key: "avgRating",
    label: "Rating",
    weight: 4,
    read: (stats) => stats.avgRating ?? 0,
  },
  {
    key: "avgRws",
    label: "RWS",
    weight: 3,
    read: (stats) => stats.avgRws ?? 0,
  },
  {
    key: "avgKast",
    label: "KAST%",
    weight: 2,
    read: (stats) => stats.avgKast ?? 0,
  },
  {
    key: "avgTradeKills",
    label: "Trade kills",
    weight: 2,
    read: (stats) => stats.avgTradeKills ?? 0,
  },
  {
    key: "avgUtilityDamage",
    label: "Utility damage",
    weight: 2,
    read: (stats) => stats.avgUtilityDamage ?? 0,
  },
  {
    key: "avgEntryRate",
    label: "Entry rate",
    weight: 2,
    read: (stats) => stats.avgEntryRate ?? 0,
  },
  {
    key: "avgEnemiesFlashed",
    label: "Enemies flashed",
    weight: 1,
    read: (stats) => stats.avgEnemiesFlashed ?? 0,
  },
  {
    key: "avgEconomyEfficiency",
    label: "Economy efficiency",
    weight: 2,
    read: (stats) => stats.avgEconomyEfficiency ?? 0,
  },
  {
    key: "totalClutchWins",
    label: "Clutches",
    weight: 1,
    read: (stats) => stats.totalClutchWins ?? 0,
  },
];

function getSessionCategories(
  allHaveDemo: boolean
): SessionCategoryDefinition[] {
  return allHaveDemo
    ? [...SAFE_CATEGORIES, ...DEMO_CATEGORIES]
    : SAFE_CATEGORIES;
}

function normalizeValue(min: number, max: number, value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (max === min) {
    return 100;
  }
  return ((value - min) / (max - min)) * 100;
}

function getBadgeFromBreakdown(breakdown: SessionScoreBreakdown): string {
  const best = breakdown.categories[0]?.key ?? "";
  if (best === "avgEntryRate") {
    return "Entry King";
  }
  if (best === "avgUtilityDamage" || best === "avgEnemiesFlashed") {
    return "Utility";
  }
  if (best === "avgRating" || best === "avgImpact") {
    return "Carry";
  }
  if (best === "winRate") {
    return "Closer";
  }
  return "Balanced";
}

function getVerdictFromBreakdown(breakdown: SessionScoreBreakdown): string {
  const top = breakdown.strongestReasons[0];
  const bottom = breakdown.weakestCategory;
  if (top && bottom) {
    return `${top} over ${bottom}`;
  }
  return top ?? "Steady session";
}

function buildScoreBreakdowns(
  aggregateStats: Record<string, AggregatePlayerStats>,
  categories: SessionCategoryDefinition[]
): Record<string, SessionScoreBreakdown> {
  const entries = Object.values(aggregateStats);
  const scoresByCategory = new Map<
    SessionCategoryDefinition["key"],
    { min: number; max: number; values: Record<string, number> }
  >();

  for (const category of categories) {
    const values: Record<string, number> = {};
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
      const value = category.read(entry);
      values[entry.faceitId] = value;
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
    scoresByCategory.set(category.key, { min, max, values });
  }

  const result: Record<string, SessionScoreBreakdown> = {};
  for (const entry of entries) {
    const categoriesWithScores = categories.map((category) => {
      const scoreData = scoresByCategory.get(category.key);
      const raw = scoreData?.values[entry.faceitId] ?? 0;
      return {
        key: String(category.key),
        label: category.label,
        score: normalizeValue(scoreData?.min ?? 0, scoreData?.max ?? 0, raw),
        weight: category.weight,
      };
    });

    const weightedTotal = categoriesWithScores.reduce(
      (sum, category) => sum + category.score * (category.weight ?? 1),
      0
    );
    const weightTotal = categoriesWithScores.reduce(
      (sum, category) => sum + (category.weight ?? 1),
      0
    );
    const sessionScore =
      weightTotal > 0 ? Math.round((weightedTotal / weightTotal) * 10) / 10 : 0;

    const sortedCategories = [...categoriesWithScores].sort(
      (a, b) =>
        b.score - a.score ||
        b.weight - a.weight ||
        a.label.localeCompare(b.label)
    );

    result[entry.faceitId] = {
      categories: sortedCategories,
      sessionScore,
      strongestReasons: sortedCategories
        .slice(0, 2)
        .map((category) => category.label),
      weakestCategory:
        sortedCategories[sortedCategories.length - 1]?.label ?? undefined,
    };
  }

  return result;
}

function compareImpact(
  left: MatchPlayerStats,
  right: MatchPlayerStats
): number {
  const leftRow: SharedStatsLeaderboardRow = {
    matchId: "",
    playedAt: null,
    faceitId: left.playerId,
    nickname: left.nickname,
    elo: 1225,
    kills: left.kills,
    kdRatio: left.kdRatio,
    adr: left.adr,
    hsPercent: left.hsPercent,
    krRatio: left.krRatio,
    win: left.result,
    firstKills: left.firstKills,
    clutchKills: left.clutchKills,
    utilityDamage: left.utilityDamage,
    enemiesFlashed: left.enemiesFlashed,
    entryCount: left.entryCount,
    entryWins: left.entryWins,
    sniperKills: left.sniperKills,
  };
  const rightRow: SharedStatsLeaderboardRow = {
    matchId: "",
    playedAt: null,
    faceitId: right.playerId,
    nickname: right.nickname,
    elo: 1225,
    kills: right.kills,
    kdRatio: right.kdRatio,
    adr: right.adr,
    hsPercent: right.hsPercent,
    krRatio: right.krRatio,
    win: right.result,
    firstKills: right.firstKills,
    clutchKills: right.clutchKills,
    utilityDamage: right.utilityDamage,
    enemiesFlashed: right.enemiesFlashed,
    entryCount: right.entryCount,
    entryWins: right.entryWins,
    sniperKills: right.sniperKills,
  };
  return computeImpactScore(leftRow) - computeImpactScore(rightRow);
}

function buildPairSummaries(params: {
  matchStats: Record<string, MatchPlayerStats[]>;
  matches: Pick<PlayerHistoryMatch, "matchId" | "startedAt" | "map">[];
  players: AggregatePlayerStats[];
}): PairSummary[] {
  const { matchStats, matches, players } = params;
  const pairMap = new Map<string, PairSummary>();
  const sortedMatches = [...matches].sort((a, b) => a.startedAt - b.startedAt);

  for (const match of sortedMatches) {
    const stats = matchStats[match.matchId] ?? [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const playerA = stats.find(
          (entry) => entry.playerId === players[i].faceitId
        );
        const playerB = stats.find(
          (entry) => entry.playerId === players[j].faceitId
        );
        if (!(playerA && playerB)) {
          continue;
        }
        const key = [players[i].faceitId, players[j].faceitId].sort().join("|");
        const existing = pairMap.get(key) ?? {
          faceitIdA: players[i].faceitId,
          faceitIdB: players[j].faceitId,
          nicknameA: players[i].nickname,
          nicknameB: players[j].nickname,
          sharedMaps: 0,
          winsA: 0,
          winsB: 0,
          totalMargin: 0,
        };
        const diff = compareImpact(playerA, playerB);
        existing.sharedMaps += 1;
        if (diff > 0) {
          existing.winsA += 1;
        } else if (diff < 0) {
          existing.winsB += 1;
        }
        existing.totalMargin += Math.abs(diff);
        pairMap.set(key, existing);
      }
    }
  }

  return [...pairMap.values()].sort(
    (a, b) =>
      b.sharedMaps - a.sharedMaps ||
      b.totalMargin - a.totalMargin ||
      a.nicknameA.localeCompare(b.nicknameA) ||
      a.nicknameB.localeCompare(b.nicknameB)
  );
}

function buildRivalryCards(pairSummaries: PairSummary[]): SessionRivalryCard[] {
  const rivalryCards: SessionRivalryCard[] = [];
  const bestHeadToHead = pairSummaries
    .filter((pair) => pair.sharedMaps > 0 && pair.winsA !== pair.winsB)
    .sort(
      (a, b) =>
        b.sharedMaps - a.sharedMaps ||
        Math.abs(b.winsA - b.winsB) - Math.abs(a.winsA - a.winsB) ||
        b.totalMargin - a.totalMargin
    )[0];

  if (bestHeadToHead) {
    const winnerIsA = bestHeadToHead.winsA > bestHeadToHead.winsB;
    rivalryCards.push({
      id: "head-to-head",
      title: "Head-to-Head",
      playerIds: winnerIsA
        ? [bestHeadToHead.faceitIdA, bestHeadToHead.faceitIdB]
        : [bestHeadToHead.faceitIdB, bestHeadToHead.faceitIdA],
      summary: `${winnerIsA ? bestHeadToHead.nicknameA : bestHeadToHead.nicknameB} beat ${winnerIsA ? bestHeadToHead.nicknameB : bestHeadToHead.nicknameA} ${winnerIsA ? bestHeadToHead.winsA : bestHeadToHead.winsB}-${winnerIsA ? bestHeadToHead.winsB : bestHeadToHead.winsA}`,
      evidence: [`${bestHeadToHead.sharedMaps} shared maps`],
    });
  }

  const closestDuel = pairSummaries
    .filter((pair) => pair.sharedMaps >= 2)
    .sort(
      (a, b) =>
        Math.abs(a.winsA - a.winsB) - Math.abs(b.winsA - b.winsB) ||
        b.sharedMaps - a.sharedMaps ||
        a.totalMargin - b.totalMargin
    )[0];
  if (closestDuel) {
    rivalryCards.push({
      id: "closest-duel",
      title: "Closest Duel",
      playerIds: [closestDuel.faceitIdA, closestDuel.faceitIdB],
      summary: `${closestDuel.nicknameA} vs ${closestDuel.nicknameB} was ${closestDuel.winsA}-${closestDuel.winsB}`,
      evidence: [`${closestDuel.sharedMaps} shared maps`],
    });
  }

  const widestGap = [...pairSummaries].sort(
    (a, b) =>
      b.totalMargin - a.totalMargin ||
      b.sharedMaps - a.sharedMaps ||
      a.nicknameA.localeCompare(b.nicknameA) ||
      a.nicknameB.localeCompare(b.nicknameB)
  )[0];
  if (widestGap) {
    const winnerIsA =
      widestGap.winsA > widestGap.winsB ||
      (widestGap.winsA === widestGap.winsB &&
        widestGap.nicknameA.localeCompare(widestGap.nicknameB) <= 0);
    const winnerNickname = winnerIsA
      ? widestGap.nicknameA
      : widestGap.nicknameB;
    const loserNickname = winnerIsA ? widestGap.nicknameB : widestGap.nicknameA;
    const winnerWins = winnerIsA ? widestGap.winsA : widestGap.winsB;
    const loserWins = winnerIsA ? widestGap.winsB : widestGap.winsA;
    rivalryCards.push({
      id: "wide-gap",
      title: "Widest Gap",
      playerIds: [widestGap.faceitIdA, widestGap.faceitIdB],
      summary: `${winnerNickname} had the bigger edge over ${loserNickname}`,
      evidence: [
        `${widestGap.sharedMaps} shared maps`,
        `${winnerWins}-${loserWins}`,
      ],
    });
  }

  return rivalryCards;
}

export function buildSessionRivalries(params: {
  aggregateStats: Record<string, AggregatePlayerStats>;
  allHaveDemo: boolean;
  matchStats: Record<string, MatchPlayerStats[]>;
  matches: Pick<PlayerHistoryMatch, "matchId" | "startedAt" | "map">[];
}): SessionRivalryData {
  const { aggregateStats, allHaveDemo, matchStats, matches } = params;
  const players = Object.values(aggregateStats);
  if (players.length === 0) {
    return {
      playerBreakdowns: {},
      podium: [],
      rivalryCards: [],
    };
  }

  const categories = getSessionCategories(allHaveDemo);
  const playerBreakdowns = buildScoreBreakdowns(aggregateStats, categories);
  const podium: SessionPodiumEntry[] = players
    .map((player) => {
      const breakdown = playerBreakdowns[player.faceitId];
      const sessionScore = breakdown?.sessionScore ?? 0;
      return {
        badge: getBadgeFromBreakdown(
          breakdown ?? {
            categories: [],
            sessionScore: 0,
            strongestReasons: [],
            weakestCategory: undefined,
          }
        ),
        faceitId: player.faceitId,
        nickname: player.nickname,
        rank: 0,
        sessionScore,
        verdict: getVerdictFromBreakdown(
          breakdown ?? {
            categories: [],
            sessionScore: 0,
            strongestReasons: [],
            weakestCategory: undefined,
          }
        ),
      };
    })
    .sort(
      (a, b) =>
        b.sessionScore - a.sessionScore || a.nickname.localeCompare(b.nickname)
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const pairSummaries = buildPairSummaries({
    matchStats,
    matches,
    players,
  });

  return {
    playerBreakdowns,
    podium,
    rivalryCards: buildRivalryCards(pairSummaries),
  };
}
