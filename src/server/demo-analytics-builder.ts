/**
 * Rich demo analytics builder — implements cs2_demo_analysis_rules.md
 *
 * Converts raw ParsedDemoFile events into full DemoMatchAnalytics
 * with all metrics: economy, clutches, exit kills, last alive,
 * opening duels, KAST%, kill timing, HS%, flash assists, utility damage,
 * weapon accuracy, post-plant, multi-kills, composite rating, streaks.
 */

import {
  buildRoundScoreProgression,
  buildWinLossStreaks,
  computeRwsForRound,
} from "~/lib/demo-analytics";
import type {
  DemoAnalyticsSourceType,
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  DemoTeamKey,
} from "~/lib/types";
import type {
  ParsedDemoBlind,
  ParsedDemoFile,
  ParsedDemoGrenadeDetonate,
  ParsedDemoHurt,
  ParsedDemoItemPurchase,
  ParsedDemoKill,
  ParsedDemoPlayer,
  ParsedDemoRound,
  ParsedDemoWeaponFire,
} from "~/server/demo-parser";

// ---------------------------------------------------------------------------
// Constants from rules doc
// ---------------------------------------------------------------------------

const CS2_TICK_RATE = 64;
const TRADE_WINDOW_TICKS = 5 * CS2_TICK_RATE;

// Kill timing thresholds (seconds after freeze end)
const KILL_TIMING_EARLY_SEC = 25;
const KILL_TIMING_MID_SEC = 60;

// Weapon classifications for economy
const RIFLES = new Set([
  "ak47",
  "aug",
  "awp",
  "famas",
  "g3sg1",
  "galilar",
  "m4a1",
  "m4a1_silencer",
  "scar20",
  "sg556",
]);
const HEAVIES = new Set(["negev", "m249"]);
const SMGS = new Set(["mac10", "mp5sd", "mp7", "mp9", "bizon", "p90", "ump45"]);
const SHOTGUNS = new Set(["mag7", "nova", "sawedoff", "xm1014"]);
const UTILITY_WEAPONS = new Set([
  "hegrenade",
  "molotov",
  "incgrenade",
  "inferno",
]);
const KNIVES_AND_GRENADES = new Set([
  "knife",
  "knife_tactical",
  "knife_butterfly",
  "knife_karambit",
  "knife_falchion",
  "knife_flip",
  "knife_gut",
  "knife_m9_bayonet",
  "knife_bayonet",
  "knife_push",
  "knife_survival_bowie",
  "knife_ursus",
  "knife_widowmaker",
  "knife_stiletto",
  "knife_gypsy_jackknife",
  "knife_css",
  "knife_cord",
  "knife_canis",
  "knife_outdoor",
  "knife_skeleton",
  "hegrenade",
  "flashbang",
  "smokegrenade",
  "molotov",
  "incgrenade",
  "decoy",
  "inferno",
  "c4",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

function stripWeaponPrefix(weapon: string): string {
  return weapon.replace(/^weapon_/, "");
}

function isKnifeOrGrenade(weapon: string): boolean {
  const w = stripWeaponPrefix(weapon);
  return KNIVES_AND_GRENADES.has(w) || w.startsWith("knife");
}

// ---------------------------------------------------------------------------
// Team mapping
// ---------------------------------------------------------------------------

function buildSteamIdToTeamKey(
  players: ParsedDemoPlayer[]
): Map<string, DemoTeamKey> {
  const map = new Map<string, DemoTeamKey>();
  for (const p of players) {
    if (!p.steamId) {
      continue;
    }
    map.set(p.steamId, p.teamNumber === 2 ? "team1" : "team2");
  }
  return map;
}

// ---------------------------------------------------------------------------
// Side detection
// ---------------------------------------------------------------------------

function detectFirstHalfSides(
  rounds: ParsedDemoRound[],
  steamToTeam: Map<string, DemoTeamKey>,
  kills: ParsedDemoKill[]
): { team1Side: "CT" | "T"; team2Side: "CT" | "T" } {
  const firstHalfRounds = rounds.filter((r) => r.roundNumber <= 12);
  let team1AsCT = 0;
  let team1AsT = 0;

  for (const round of firstHalfRounds) {
    const winnerSide = String(round.winner);
    const roundKills = kills.filter((k) => k.roundNumber === round.roundNumber);
    let team1Kills = 0;
    let team2Kills = 0;
    for (const k of roundKills) {
      const team = steamToTeam.get(k.attackerSteamId);
      if (team === "team1") {
        team1Kills++;
      } else if (team === "team2") {
        team2Kills++;
      }
    }
    if (team1Kills > team2Kills) {
      if (winnerSide === "CT") {
        team1AsCT++;
      } else if (winnerSide === "T") {
        team1AsT++;
      }
    } else if (team2Kills > team1Kills) {
      if (winnerSide === "CT") {
        team1AsT++;
      } else if (winnerSide === "T") {
        team1AsCT++;
      }
    }
  }

  const team1FirstHalf = team1AsCT >= team1AsT ? "CT" : "T";
  return {
    team1Side: team1FirstHalf,
    team2Side: team1FirstHalf === "CT" ? "T" : "CT",
  };
}

function getTeamSidesForRound(
  roundNumber: number,
  totalRounds: number,
  team1FirstHalfSide: "CT" | "T"
): { tTeamKey: DemoTeamKey; ctTeamKey: DemoTeamKey } {
  const isRegSecondHalf = roundNumber > 12 && roundNumber <= 24;
  // Overtime: sides swap every 3 rounds within each OT series
  const isOvertime = roundNumber > 24;
  let swapped = isRegSecondHalf;
  if (isOvertime) {
    const otRound = roundNumber - 24;
    const otHalf = Math.floor((otRound - 1) / 3); // 0-indexed half within OT
    // odd half = swapped from first OT half
    swapped = otHalf % 2 === 1;
    // but first OT half continues from second half sides, which are already swapped
    swapped = !swapped; // so actually: even = swapped (from regulation perspective), odd = not
  }

  if (swapped) {
    const tTeamKey: DemoTeamKey =
      team1FirstHalfSide === "T" ? "team2" : "team1";
    return { tTeamKey, ctTeamKey: tTeamKey === "team1" ? "team2" : "team1" };
  }
  const tTeamKey: DemoTeamKey = team1FirstHalfSide === "T" ? "team1" : "team2";
  return { tTeamKey, ctTeamKey: tTeamKey === "team1" ? "team2" : "team1" };
}

function mapRoundWinnerToTeamKey(
  winnerSide: string | null,
  roundNumber: number,
  totalRounds: number,
  team1FirstHalfSide: "CT" | "T"
): DemoTeamKey | null {
  if (!winnerSide || (winnerSide !== "CT" && winnerSide !== "T")) {
    return null;
  }
  const { tTeamKey, ctTeamKey } = getTeamSidesForRound(
    roundNumber,
    totalRounds,
    team1FirstHalfSide
  );
  return winnerSide === "T" ? tTeamKey : ctTeamKey;
}

// ---------------------------------------------------------------------------
// Economy classification (from weapon_fire events)
// ---------------------------------------------------------------------------

type BuyType = "full_buy" | "force_buy" | "eco" | "unknown";

function classifyTeamBuy(
  weaponFires: ParsedDemoWeaponFire[],
  teamSteamIds: Set<string>
): BuyType {
  let hasRifleOrHeavy = false;
  let hasSmgOrShotgun = false;

  for (const fire of weaponFires) {
    if (!teamSteamIds.has(fire.playerSteamId)) {
      continue;
    }
    const w = stripWeaponPrefix(fire.weapon);
    if (isKnifeOrGrenade(fire.weapon)) {
      continue;
    }
    if (RIFLES.has(w) || HEAVIES.has(w)) {
      hasRifleOrHeavy = true;
      break;
    }
    if (SMGS.has(w) || SHOTGUNS.has(w)) {
      hasSmgOrShotgun = true;
    }
  }

  if (hasRifleOrHeavy) {
    return "full_buy";
  }
  if (hasSmgOrShotgun) {
    return "force_buy";
  }
  return "eco";
}

// ---------------------------------------------------------------------------
// Trade kills
// ---------------------------------------------------------------------------

interface TradeResult {
  tradedDeaths: Map<string, number>;
  tradeKills: Map<string, number>;
  untradedDeaths: Map<string, number>;
}

function computeTrades(
  roundKills: ParsedDemoKill[],
  steamToTeam: Map<string, DemoTeamKey>
): TradeResult {
  const tradeKills = new Map<string, number>();
  const tradedDeaths = new Map<string, number>();
  const untradedDeaths = new Map<string, number>();
  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (let i = 0; i < sorted.length; i++) {
    const death = sorted[i];
    const victimTeam = steamToTeam.get(death.victimSteamId);
    if (!victimTeam) {
      continue;
    }

    let traded = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (next.tick - death.tick > TRADE_WINDOW_TICKS) {
        break;
      }
      const nextKillerTeam = steamToTeam.get(next.attackerSteamId);
      const nextVictimTeam = steamToTeam.get(next.victimSteamId);
      if (nextKillerTeam === victimTeam && nextVictimTeam !== victimTeam) {
        traded = true;
        tradeKills.set(
          next.attackerSteamId,
          (tradeKills.get(next.attackerSteamId) ?? 0) + 1
        );
        tradedDeaths.set(
          death.victimSteamId,
          (tradedDeaths.get(death.victimSteamId) ?? 0) + 1
        );
        break;
      }
    }
    if (!traded) {
      untradedDeaths.set(
        death.victimSteamId,
        (untradedDeaths.get(death.victimSteamId) ?? 0) + 1
      );
    }
  }

  return { tradeKills, tradedDeaths, untradedDeaths };
}

// ---------------------------------------------------------------------------
// Clutch detection
// ---------------------------------------------------------------------------

interface ClutchInfo {
  killsDuringClutch: number;
  playerSteamId: string;
  teamKey: DemoTeamKey;
  vs: number;
  won: boolean;
}

function detectClutch(
  roundKills: ParsedDemoKill[],
  allSteamIds: string[],
  steamToTeam: Map<string, DemoTeamKey>,
  roundWinner: DemoTeamKey | null
): ClutchInfo | null {
  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set(
    "team1",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1"))
  );
  alive.set(
    "team2",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2"))
  );

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);
  let clutchPlayer: string | null = null;
  let clutchTeam: DemoTeamKey | null = null;
  let clutchVs = 0;
  let clutchStartIdx = -1;

  for (let i = 0; i < sorted.length; i++) {
    const kill = sorted[i];
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) {
      alive.get(victimTeam)?.delete(kill.victimSteamId);
    }

    const t1Alive = alive.get("team1")!.size;
    const t2Alive = alive.get("team2")!.size;

    if (!clutchPlayer) {
      if (t1Alive === 1 && t2Alive >= 2) {
        clutchPlayer = [...alive.get("team1")!][0];
        clutchTeam = "team1";
        clutchVs = t2Alive;
        clutchStartIdx = i + 1;
      } else if (t2Alive === 1 && t1Alive >= 2) {
        clutchPlayer = [...alive.get("team2")!][0];
        clutchTeam = "team2";
        clutchVs = t1Alive;
        clutchStartIdx = i + 1;
      }
    }
  }

  if (!(clutchPlayer && clutchTeam)) {
    return null;
  }

  const killsDuringClutch = sorted
    .slice(clutchStartIdx)
    .filter((k) => k.attackerSteamId === clutchPlayer).length;

  return {
    playerSteamId: clutchPlayer,
    teamKey: clutchTeam,
    vs: clutchVs,
    won: roundWinner === clutchTeam,
    killsDuringClutch,
  };
}

// ---------------------------------------------------------------------------
// Exit kill detection
// ---------------------------------------------------------------------------

function detectExitKills(
  roundKills: ParsedDemoKill[],
  allSteamIds: string[],
  steamToTeam: Map<string, DemoTeamKey>,
  roundWinner: DemoTeamKey | null
): Set<number> {
  const exitKillIndices = new Set<number>();
  if (!roundWinner) {
    return exitKillIndices;
  }

  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set(
    "team1",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1"))
  );
  alive.set(
    "team2",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2"))
  );

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (let i = 0; i < sorted.length; i++) {
    const kill = sorted[i];
    const attackerTeam = steamToTeam.get(kill.attackerSteamId);
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) {
      alive.get(victimTeam)?.delete(kill.victimSteamId);
    }

    // Exit kill: attacker's team LOSES the round, attacker is last alive, 1v3+
    if (attackerTeam && attackerTeam !== roundWinner) {
      const attackerTeamAlive = alive.get(attackerTeam)!.size;
      const otherTeam = attackerTeam === "team1" ? "team2" : "team1";
      const otherTeamAlive = alive.get(otherTeam)!.size;
      if (attackerTeamAlive === 1 && otherTeamAlive >= 3) {
        // Check attacker is the last alive
        if (alive.get(attackerTeam)!.has(kill.attackerSteamId)) {
          exitKillIndices.add(i);
        }
      }
    }
  }

  return exitKillIndices;
}

// ---------------------------------------------------------------------------
// Last alive detection
// ---------------------------------------------------------------------------

function detectLastAlive(
  roundKills: ParsedDemoKill[],
  allSteamIds: string[],
  steamToTeam: Map<string, DemoTeamKey>
): string | null {
  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set(
    "team1",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1"))
  );
  alive.set(
    "team2",
    new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2"))
  );

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (const kill of sorted) {
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) {
      alive.get(victimTeam)?.delete(kill.victimSteamId);
    }

    for (const [, teamAlive] of alive) {
      if (teamAlive.size === 1) {
        return [...teamAlive][0];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Opening duel (first kill of each round)
// ---------------------------------------------------------------------------

function getOpeningDuel(roundKills: ParsedDemoKill[]): ParsedDemoKill | null {
  if (roundKills.length === 0) {
    return null;
  }
  return roundKills.reduce((earliest, k) =>
    k.tick < earliest.tick ? k : earliest
  );
}

// ---------------------------------------------------------------------------
// Kill timing classification
// ---------------------------------------------------------------------------

type KillTiming = "early" | "mid" | "late";

function classifyKillTiming(
  killTick: number,
  freezeEndTick: number
): KillTiming {
  const seconds = (killTick - freezeEndTick) / CS2_TICK_RATE;
  if (seconds <= KILL_TIMING_EARLY_SEC) {
    return "early";
  }
  if (seconds <= KILL_TIMING_MID_SEC) {
    return "mid";
  }
  return "late";
}

// ---------------------------------------------------------------------------
// Utility mastery
// ---------------------------------------------------------------------------

interface UtilityMasteryResult {
  avgFlashBlindDuration: number;
  effectiveFlashRate: number;
  flashesThrown: number;
  hesThrown: number;
  molotovsThrown: number;
  smokesThrown: number;
  teamFlashes: number;
  utilityPerRound: number;
}

function computeUtilityMastery(
  grenadeDetonates: ParsedDemoGrenadeDetonate[],
  blinds: ParsedDemoBlind[],
  steamToTeam: Map<string, DemoTeamKey>,
  totalRounds: number
): Map<string, UtilityMasteryResult> {
  const result = new Map<string, UtilityMasteryResult>();

  for (const g of grenadeDetonates) {
    if (!g.steamId) {
      continue;
    }
    let entry = result.get(g.steamId);
    if (!entry) {
      entry = {
        smokesThrown: 0,
        flashesThrown: 0,
        hesThrown: 0,
        molotovsThrown: 0,
        utilityPerRound: 0,
        avgFlashBlindDuration: 0,
        teamFlashes: 0,
        effectiveFlashRate: 0,
      };
      result.set(g.steamId, entry);
    }
    if (g.type === "smoke") {
      entry.smokesThrown++;
    } else if (g.type === "flash") {
      entry.flashesThrown++;
    } else if (g.type === "he") {
      entry.hesThrown++;
    } else if (g.type === "molotov") {
      entry.molotovsThrown++;
    }
  }

  const blindsByAttacker = new Map<string, ParsedDemoBlind[]>();
  for (const b of blinds) {
    const arr = blindsByAttacker.get(b.attackerSteamId) ?? [];
    arr.push(b);
    blindsByAttacker.set(b.attackerSteamId, arr);
  }

  for (const [steamId, entry] of result) {
    const totalUtil =
      entry.smokesThrown +
      entry.flashesThrown +
      entry.hesThrown +
      entry.molotovsThrown;
    entry.utilityPerRound =
      totalRounds > 0 ? Math.round((totalUtil / totalRounds) * 10) / 10 : 0;

    const playerBlinds = blindsByAttacker.get(steamId) ?? [];
    const flasherTeam = steamToTeam.get(steamId);

    const enemyBlinds = playerBlinds.filter(
      (b) => steamToTeam.get(b.victimSteamId) !== flasherTeam
    );
    if (enemyBlinds.length > 0) {
      entry.avgFlashBlindDuration =
        Math.round(
          (enemyBlinds.reduce((s, b) => s + b.duration, 0) /
            enemyBlinds.length) *
            100
        ) / 100;
    }

    entry.teamFlashes = playerBlinds.filter((b) => {
      const blindedTeam = steamToTeam.get(b.victimSteamId);
      return flasherTeam && blindedTeam && flasherTeam === blindedTeam;
    }).length;

    if (entry.flashesThrown > 0) {
      const flashDetonates = grenadeDetonates.filter(
        (g) => g.type === "flash" && g.steamId === steamId
      );
      let effectiveFlashes = 0;
      for (const fd of flashDetonates) {
        const hasEnemyBlind = playerBlinds.some(
          (b) =>
            Math.abs(b.tick - fd.tick) <= 64 &&
            steamToTeam.get(b.victimSteamId) !== flasherTeam
        );
        if (hasEnemyBlind) {
          effectiveFlashes++;
        }
      }
      entry.effectiveFlashRate = Math.round(
        (effectiveFlashes / entry.flashesThrown) * 100
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Kill quality
// ---------------------------------------------------------------------------

interface KillQualityResult {
  avgKillDistance: number;
  noscopeKills: number;
  thrusmokeKills: number;
  wallbangKills: number;
  weaponKills: Record<string, number>;
}

function computeKillQuality(
  kills: ParsedDemoKill[]
): Map<string, KillQualityResult> {
  const result = new Map<string, KillQualityResult>();

  for (const k of kills) {
    if (!k.attackerSteamId) {
      continue;
    }
    let entry = result.get(k.attackerSteamId);
    if (!entry) {
      entry = {
        wallbangKills: 0,
        thrusmokeKills: 0,
        noscopeKills: 0,
        avgKillDistance: 0,
        weaponKills: {},
      };
      result.set(k.attackerSteamId, entry);
    }
    if (k.penetrated) {
      entry.wallbangKills++;
    }
    if (k.thruSmoke) {
      entry.thrusmokeKills++;
    }
    if (k.noscope) {
      entry.noscopeKills++;
    }
    const weapon = stripWeaponPrefix(k.weapon);
    entry.weaponKills[weapon] = (entry.weaponKills[weapon] ?? 0) + 1;
  }

  for (const [steamId, entry] of result) {
    const playerKills = kills.filter(
      (k) => k.attackerSteamId === steamId && k.distance > 0
    );
    if (playerKills.length > 0) {
      entry.avgKillDistance =
        Math.round(
          (playerKills.reduce((s, k) => s + k.distance, 0) /
            playerKills.length) *
            10
        ) / 10;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

interface EconomyResult {
  economyEfficiency: number;
  totalSpend: number;
  weaponRounds: Record<string, number>;
}

function classifyWeaponRound(purchases: ParsedDemoItemPurchase[]): string {
  const weapons = purchases.map((p) =>
    p.itemName.toLowerCase().replace(/[- ]/g, "")
  );
  for (const w of weapons) {
    if (w === "awp") {
      return "awp";
    }
  }
  for (const p of purchases) {
    if (p.cost >= 2700) {
      return "rifle";
    }
  }
  for (const p of purchases) {
    if (p.cost >= 1050 && p.cost < 2700) {
      return "smg";
    }
  }
  return "pistol";
}

function computeEconomy(
  itemPurchases: ParsedDemoItemPurchase[],
  totalDamageByPlayer: Map<string, number>
): Map<string, EconomyResult> {
  const result = new Map<string, EconomyResult>();

  const byPlayer = new Map<string, ParsedDemoItemPurchase[]>();
  for (const p of itemPurchases) {
    if (!p.steamId) {
      continue;
    }
    const arr = byPlayer.get(p.steamId) ?? [];
    arr.push(p);
    byPlayer.set(p.steamId, arr);
  }

  for (const [steamId, purchases] of byPlayer) {
    const totalSpend = purchases.reduce((s, p) => s + p.cost, 0);
    const totalDamage = totalDamageByPlayer.get(steamId) ?? 0;
    const economyEfficiency =
      totalSpend > 0
        ? Math.round((totalDamage / totalSpend) * 1000 * 10) / 10
        : 0;

    const byRound = new Map<number, ParsedDemoItemPurchase[]>();
    for (const p of purchases) {
      const arr = byRound.get(p.roundNumber) ?? [];
      arr.push(p);
      byRound.set(p.roundNumber, arr);
    }
    const weaponRounds: Record<string, number> = {};
    for (const [, roundPurchases] of byRound) {
      const cat = classifyWeaponRound(roundPurchases);
      weaponRounds[cat] = (weaponRounds[cat] ?? 0) + 1;
    }

    result.set(steamId, { totalSpend, economyEfficiency, weaponRounds });
  }

  return result;
}

function computeRoundEquipValues(
  itemPurchases: ParsedDemoItemPurchase[],
  steamToTeam: Map<string, DemoTeamKey>,
  roundNumber: number,
  tTeamKey: DemoTeamKey
): { tEquipValue: number; ctEquipValue: number } {
  const roundPurchases = itemPurchases.filter(
    (p) => p.roundNumber === roundNumber
  );
  let tEquipValue = 0;
  let ctEquipValue = 0;
  for (const p of roundPurchases) {
    const team = steamToTeam.get(p.steamId);
    if (team === tTeamKey) {
      tEquipValue += p.cost;
    } else {
      ctEquipValue += p.cost;
    }
  }
  return { tEquipValue, ctEquipValue };
}

// ---------------------------------------------------------------------------
// Side split
// ---------------------------------------------------------------------------

interface SideSplitResult {
  ctAdr: number;
  ctDeaths: number;
  ctKills: number;
  ctRating: number;
  tAdr: number;
  tDeaths: number;
  tKills: number;
  tRating: number;
}

function computeSideSplit(
  kills: ParsedDemoKill[],
  hurts: ParsedDemoHurt[],
  rounds: ParsedDemoRound[],
  steamToTeam: Map<string, DemoTeamKey>,
  team1FirstHalfSide: "CT" | "T",
  allSteamIds: string[]
): Map<string, SideSplitResult> {
  const result = new Map<string, SideSplitResult>();
  const sideAccum = new Map<
    string,
    {
      ct: { kills: number; deaths: number; damage: number; rounds: number };
      t: { kills: number; deaths: number; damage: number; rounds: number };
    }
  >();

  for (const steamId of allSteamIds) {
    result.set(steamId, {
      ctKills: 0,
      ctDeaths: 0,
      ctAdr: 0,
      ctRating: 0,
      tKills: 0,
      tDeaths: 0,
      tAdr: 0,
      tRating: 0,
    });
    sideAccum.set(steamId, {
      ct: { kills: 0, deaths: 0, damage: 0, rounds: 0 },
      t: { kills: 0, deaths: 0, damage: 0, rounds: 0 },
    });
  }

  function getPlayerSide(steamId: string, roundNumber: number): "CT" | "T" {
    const teamKey = steamToTeam.get(steamId);
    const { tTeamKey } = getTeamSidesForRound(
      roundNumber,
      rounds.length,
      team1FirstHalfSide
    );
    return teamKey === tTeamKey ? "T" : "CT";
  }

  for (const round of rounds) {
    for (const steamId of allSteamIds) {
      const side = getPlayerSide(steamId, round.roundNumber);
      const acc = sideAccum.get(steamId)!;
      if (side === "CT") {
        acc.ct.rounds++;
      } else {
        acc.t.rounds++;
      }
    }
  }

  for (const k of kills) {
    if (!(k.attackerSteamId && k.victimSteamId)) {
      continue;
    }
    const attackerSide = getPlayerSide(k.attackerSteamId, k.roundNumber);
    const victimSide = getPlayerSide(k.victimSteamId, k.roundNumber);
    const ae = result.get(k.attackerSteamId);
    const ve = result.get(k.victimSteamId);
    const aa = sideAccum.get(k.attackerSteamId);
    const va = sideAccum.get(k.victimSteamId);
    if (ae && aa) {
      if (attackerSide === "CT") {
        ae.ctKills++;
        aa.ct.kills++;
      } else {
        ae.tKills++;
        aa.t.kills++;
      }
    }
    if (ve && va) {
      if (victimSide === "CT") {
        ve.ctDeaths++;
        va.ct.deaths++;
      } else {
        ve.tDeaths++;
        va.t.deaths++;
      }
    }
  }

  for (const h of hurts) {
    if (!h.attackerSteamId) {
      continue;
    }
    const side = getPlayerSide(h.attackerSteamId, h.roundNumber);
    const acc = sideAccum.get(h.attackerSteamId);
    if (acc) {
      if (side === "CT") {
        acc.ct.damage += h.damage;
      } else {
        acc.t.damage += h.damage;
      }
    }
  }

  for (const [steamId, entry] of result) {
    const acc = sideAccum.get(steamId)!;
    entry.ctAdr =
      acc.ct.rounds > 0
        ? Math.round((acc.ct.damage / acc.ct.rounds) * 10) / 10
        : 0;
    entry.tAdr =
      acc.t.rounds > 0
        ? Math.round((acc.t.damage / acc.t.rounds) * 10) / 10
        : 0;
    entry.ctRating = computeRating({
      kills: acc.ct.kills,
      deaths: acc.ct.deaths,
      totalDamage: acc.ct.damage,
      kastRounds: 0,
      roundsPlayed: acc.ct.rounds,
      entryKills: 0,
      clutchWins: 0,
    });
    entry.tRating = computeRating({
      kills: acc.t.kills,
      deaths: acc.t.deaths,
      totalDamage: acc.t.damage,
      kastRounds: 0,
      roundsPlayed: acc.t.rounds,
      entryKills: 0,
      clutchWins: 0,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Composite rating (approximation of HLTV 2.0)
// ---------------------------------------------------------------------------

interface RatingInput {
  clutchWins: number;
  deaths: number;
  entryKills: number;
  kastRounds: number;
  kills: number;
  roundsPlayed: number;
  totalDamage: number;
}

function computeRating(a: RatingInput): number {
  if (a.roundsPlayed === 0) {
    return 0;
  }

  const kpr = a.kills / a.roundsPlayed;
  const dpr = a.deaths / a.roundsPlayed;
  const adrFactor = a.totalDamage / a.roundsPlayed / 151.5;
  const kastFactor = a.kastRounds / a.roundsPlayed;
  const impact = (a.entryKills + a.clutchWins * 2) / a.roundsPlayed;

  const rating =
    0.25 * kpr * 3.0 +
    0.2 * (1 - dpr * 1.2) +
    0.2 * adrFactor +
    0.2 * kastFactor +
    0.15 * impact * 2.0;

  return Math.round(rating * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-player accumulator
// ---------------------------------------------------------------------------

interface PlayerAccum {
  assists: number;
  bombDefuses: number;
  bombPlants: number;
  clutchAttempts: number;
  clutchWins: number;
  deaths: number;
  enemiesFlashed: number;
  entryDeaths: number;
  entryKills: number;
  exitKills: number;
  flashAssists: number;
  headshots: number;
  kastRounds: number;
  kills: number;
  killTimings: { early: number; mid: number; late: number };
  lastAliveRounds: number;
  multiKills: { threeK: number; fourK: number; ace: number };
  nickname: string;
  openingDuelAttempts: number;
  openingDuelWins: number;
  roundsPlayed: number;
  rwsValues: number[];
  steamId: string;
  teamKey: DemoTeamKey;
  totalDamage: number;
  tradedDeaths: number;
  tradeKills: number;
  untradedDeaths: number;
  utilityDamage: number;
}

function emptyAccum(
  steamId: string,
  nickname: string,
  teamKey: DemoTeamKey
): PlayerAccum {
  return {
    steamId,
    nickname,
    teamKey,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0,
    totalDamage: 0,
    utilityDamage: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    untradedDeaths: 0,
    entryKills: 0,
    entryDeaths: 0,
    openingDuelAttempts: 0,
    openingDuelWins: 0,
    exitKills: 0,
    clutchAttempts: 0,
    clutchWins: 0,
    lastAliveRounds: 0,
    bombPlants: 0,
    bombDefuses: 0,
    flashAssists: 0,
    enemiesFlashed: 0,
    rwsValues: [],
    multiKills: { threeK: 0, fourK: 0, ace: 0 },
    killTimings: { early: 0, mid: 0, late: 0 },
    kastRounds: 0,
    roundsPlayed: 0,
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildRichDemoAnalytics(
  matchId: string,
  sourceType: DemoAnalyticsSourceType,
  parsed: ParsedDemoFile
): DemoMatchAnalytics {
  const steamToTeam = buildSteamIdToTeamKey(parsed.playerInfo.players);
  const allSteamIds = parsed.playerInfo.players
    .map((p) => p.steamId)
    .filter(Boolean);
  const team1SteamIds = new Set(
    allSteamIds.filter((id) => steamToTeam.get(id) === "team1")
  );
  const team2SteamIds = new Set(
    allSteamIds.filter((id) => steamToTeam.get(id) === "team2")
  );

  const { team1Side, team2Side } = detectFirstHalfSides(
    parsed.rounds,
    steamToTeam,
    parsed.kills
  );
  const totalRounds = parsed.rounds.length;

  // Group events by round
  const killsByRound = groupBy(parsed.kills, (k) => k.roundNumber);
  const hurtsByRound = groupBy(parsed.hurts, (h) => h.roundNumber);
  const bombsByRound = groupBy(parsed.bombEvents, (b) => b.roundNumber);
  const firesByRound = groupBy(parsed.weaponFires, (f) => f.roundNumber);
  const blindsByRound = groupBy(parsed.blinds, (b) => b.roundNumber);
  const timingByRound = new Map(
    parsed.roundTimings.map((t) => [t.roundNumber, t.freezeEndTick])
  );

  // Player accumulators
  const accums = new Map<string, PlayerAccum>();
  for (const p of parsed.playerInfo.players) {
    if (!p.steamId) {
      continue;
    }
    accums.set(
      p.steamId,
      emptyAccum(p.steamId, p.nickname, steamToTeam.get(p.steamId) ?? "team1")
    );
  }

  // ---- Process each round ----
  const roundAnalytics: DemoRoundAnalytics[] = [];
  const roundWinners: (DemoTeamKey | null)[] = [];

  for (const round of parsed.rounds) {
    const rn = round.roundNumber;
    const roundKills = killsByRound.get(rn) ?? [];
    const roundHurts = hurtsByRound.get(rn) ?? [];
    const roundBombs = bombsByRound.get(rn) ?? [];
    const roundFires = firesByRound.get(rn) ?? [];
    const roundBlinds = blindsByRound.get(rn) ?? [];
    const freezeEndTick = timingByRound.get(rn) ?? 0;

    const winnerSide =
      typeof round.winner === "string" ? (round.winner as "CT" | "T") : null;
    const winnerTeamKey = mapRoundWinnerToTeamKey(
      winnerSide,
      rn,
      totalRounds,
      team1Side
    );
    roundWinners.push(winnerTeamKey);

    const { tTeamKey, ctTeamKey } = getTeamSidesForRound(
      rn,
      totalRounds,
      team1Side
    );
    const tSteamIds = tTeamKey === "team1" ? team1SteamIds : team2SteamIds;
    const ctSteamIds = tTeamKey === "team1" ? team2SteamIds : team1SteamIds;

    const planted = roundBombs.find((b) => b.type === "planted");
    const defused = roundBombs.find((b) => b.type === "defused");
    const isPistol = rn === 1 || rn === 13;

    // Economy
    const tBuyType = classifyTeamBuy(roundFires, tSteamIds);
    const ctBuyType = classifyTeamBuy(roundFires, ctSteamIds);

    // Per-round player damage
    const roundPlayerDamage = new Map<string, number>();
    const roundPlayerUtilDamage = new Map<string, number>();
    for (const h of roundHurts) {
      if (h.attackerSteamId) {
        roundPlayerDamage.set(
          h.attackerSteamId,
          (roundPlayerDamage.get(h.attackerSteamId) ?? 0) + h.damage
        );
        const w = stripWeaponPrefix(h.weapon);
        if (UTILITY_WEAPONS.has(w)) {
          roundPlayerUtilDamage.set(
            h.attackerSteamId,
            (roundPlayerUtilDamage.get(h.attackerSteamId) ?? 0) + h.damage
          );
        }
      }
    }

    // Per-round player kills/deaths/assists
    const roundPlayerKills = new Map<string, number>();
    const roundPlayerDeaths = new Map<string, number>();
    const roundPlayerAssists = new Set<string>();
    const roundPlayerHeadshots = new Map<string, number>();
    const deadThisRound = new Set<string>();

    const sortedKills = [...roundKills].sort((a, b) => a.tick - b.tick);
    for (const k of sortedKills) {
      if (k.attackerSteamId) {
        roundPlayerKills.set(
          k.attackerSteamId,
          (roundPlayerKills.get(k.attackerSteamId) ?? 0) + 1
        );
      }
      if (k.victimSteamId) {
        roundPlayerDeaths.set(
          k.victimSteamId,
          (roundPlayerDeaths.get(k.victimSteamId) ?? 0) + 1
        );
        deadThisRound.add(k.victimSteamId);
      }
      if (k.assisterSteamId) {
        roundPlayerAssists.add(k.assisterSteamId);
      }
      if (k.headshot && k.attackerSteamId) {
        roundPlayerHeadshots.set(
          k.attackerSteamId,
          (roundPlayerHeadshots.get(k.attackerSteamId) ?? 0) + 1
        );
      }
    }

    // Trades
    const trades = computeTrades(roundKills, steamToTeam);

    // Opening duel
    const openingKill = getOpeningDuel(roundKills);

    // Clutch
    const clutch = detectClutch(
      roundKills,
      allSteamIds,
      steamToTeam,
      winnerTeamKey
    );

    // Exit kills
    const exitKillIndices = detectExitKills(
      roundKills,
      allSteamIds,
      steamToTeam,
      winnerTeamKey
    );

    // Last alive
    const lastAlivePlayer = detectLastAlive(
      roundKills,
      allSteamIds,
      steamToTeam
    );

    // Flash assists (from kill events) and enemy flashed (from blind events)
    for (const k of roundKills) {
      if (k.assistedFlash && k.assisterSteamId) {
        const a = accums.get(k.assisterSteamId);
        if (a) {
          a.flashAssists++;
        }
      }
    }
    for (const b of roundBlinds) {
      const flasherTeam = steamToTeam.get(b.attackerSteamId);
      const blindedTeam = steamToTeam.get(b.victimSteamId);
      if (flasherTeam && blindedTeam && flasherTeam !== blindedTeam) {
        const a = accums.get(b.attackerSteamId);
        if (a) {
          a.enemiesFlashed++;
        }
      }
    }

    // Bomb plants/defuses
    if (planted) {
      const a = accums.get(planted.playerSteamId);
      if (a) {
        a.bombPlants++;
      }
    }
    if (defused) {
      const a = accums.get(defused.playerSteamId);
      if (a) {
        a.bombDefuses++;
      }
    }

    // RWS
    const rwsPlayers = allSteamIds.map((id) => ({
      playerId: id,
      teamKey: steamToTeam.get(id) ?? ("team1" as DemoTeamKey),
      damage: roundPlayerDamage.get(id) ?? 0,
      alive: !deadThisRound.has(id),
    }));
    const bombBonusPlayerId = planted
      ? ((round.reason === "bomb_exploded" ? planted.playerSteamId : null) ??
        (defused ? defused.playerSteamId : null))
      : null;
    const roundRws = computeRwsForRound({
      winningTeamKey: winnerTeamKey,
      bombBonusPlayerId,
      players: rwsPlayers,
    });

    // Kill timing classification
    const killTimingMap = new Map<number, KillTiming>();
    for (let i = 0; i < sortedKills.length; i++) {
      killTimingMap.set(
        i,
        classifyKillTiming(sortedKills[i].tick, freezeEndTick)
      );
    }

    // ---- Accumulate per-player stats ----
    for (const [steamId, a] of accums) {
      a.roundsPlayed++;
      a.kills += roundPlayerKills.get(steamId) ?? 0;
      a.deaths += roundPlayerDeaths.get(steamId) ?? 0;
      if (roundPlayerAssists.has(steamId)) {
        a.assists++;
      }
      a.headshots += roundPlayerHeadshots.get(steamId) ?? 0;
      a.totalDamage += roundPlayerDamage.get(steamId) ?? 0;
      a.utilityDamage += roundPlayerUtilDamage.get(steamId) ?? 0;
      a.tradeKills += trades.tradeKills.get(steamId) ?? 0;
      a.tradedDeaths += trades.tradedDeaths.get(steamId) ?? 0;
      a.untradedDeaths += trades.untradedDeaths.get(steamId) ?? 0;
      a.rwsValues.push(roundRws[steamId] ?? 0);

      // Opening duel
      if (openingKill) {
        if (openingKill.attackerSteamId === steamId) {
          a.openingDuelAttempts++;
          a.openingDuelWins++;
          a.entryKills++;
        }
        if (openingKill.victimSteamId === steamId) {
          a.openingDuelAttempts++;
          a.entryDeaths++;
        }
      }

      // Clutch
      if (clutch && clutch.playerSteamId === steamId) {
        a.clutchAttempts++;
        if (clutch.won) {
          a.clutchWins++;
        }
      }

      // Exit kills
      for (const idx of exitKillIndices) {
        if (sortedKills[idx].attackerSteamId === steamId) {
          a.exitKills++;
        }
      }

      // Last alive
      if (lastAlivePlayer === steamId) {
        a.lastAliveRounds++;
      }

      // Kill timing
      for (let i = 0; i < sortedKills.length; i++) {
        if (sortedKills[i].attackerSteamId === steamId) {
          const timing = killTimingMap.get(i)!;
          a.killTimings[timing]++;
        }
      }

      // Multi-kills
      const rKills = roundPlayerKills.get(steamId) ?? 0;
      if (rKills === 3) {
        a.multiKills.threeK++;
      } else if (rKills === 4) {
        a.multiKills.fourK++;
      } else if (rKills >= 5) {
        a.multiKills.ace++;
      }

      // KAST: Kill, Assist, Survived, Traded
      const hasKill = (roundPlayerKills.get(steamId) ?? 0) > 0;
      const hasAssist = roundPlayerAssists.has(steamId);
      const survived = !deadThisRound.has(steamId);
      const wasTraded = (trades.tradedDeaths.get(steamId) ?? 0) > 0;
      if (hasKill || hasAssist || survived || wasTraded) {
        a.kastRounds++;
      }
    }

    // ---- Build round analytics ----
    const scoreProgression = buildRoundScoreProgression(roundWinners);
    const lastScore = scoreProgression[scoreProgression.length - 1]
      ?.scoreAfterRound ?? { team1: 0, team2: 0 };

    roundAnalytics.push({
      roundNumber: rn,
      winnerTeamKey,
      winnerSide,
      isPistolRound: isPistol,
      isBombRound: !!planted,
      scoreAfterRound: lastScore,
      tTeamKey,
      ctTeamKey,
      tBuyType: isPistol ? "eco" : tBuyType,
      ctBuyType: isPistol ? "eco" : ctBuyType,
      endReason: round.reason,
      bombPlanted: !!planted,
      bombDefused: !!defused,
      planterSteamId: planted?.playerSteamId ?? null,
      defuserSteamId: defused?.playerSteamId ?? null,
      ...computeRoundEquipValues(
        parsed.itemPurchases ?? [],
        steamToTeam,
        rn,
        tTeamKey
      ),
    });
  }

  // Fix score progression: use buildRoundScoreProgression on all round winners
  const fullScoreProgression = buildRoundScoreProgression(roundWinners);
  for (let i = 0; i < roundAnalytics.length; i++) {
    roundAnalytics[i].scoreAfterRound = fullScoreProgression[i]
      ?.scoreAfterRound ?? { team1: 0, team2: 0 };
  }

  // Extended analytics
  const utilityMastery = computeUtilityMastery(
    parsed.grenadeDetonates ?? [],
    parsed.blinds,
    steamToTeam,
    totalRounds
  );
  const killQuality = computeKillQuality(parsed.kills);
  const totalDamageByPlayer = new Map<string, number>();
  for (const a of accums.values()) {
    totalDamageByPlayer.set(a.steamId, a.totalDamage);
  }
  const economy = computeEconomy(
    parsed.itemPurchases ?? [],
    totalDamageByPlayer
  );
  const sideSplit = computeSideSplit(
    parsed.kills,
    parsed.hurts,
    parsed.rounds,
    steamToTeam,
    team1Side,
    allSteamIds
  );

  // ---- Build player analytics ----
  const streaks = buildWinLossStreaks(roundWinners);

  const players: DemoPlayerAnalytics[] = [...accums.values()].map((a) => {
    const avgRws =
      a.rwsValues.length > 0
        ? a.rwsValues.reduce((s, v) => s + v, 0) / a.rwsValues.length
        : 0;
    const hsPercent =
      a.kills > 0 ? Math.round((a.headshots / a.kills) * 1000) / 10 : 0;
    const kastPercent =
      a.roundsPlayed > 0
        ? Math.round((a.kastRounds / a.roundsPlayed) * 1000) / 10
        : 0;
    const rating = computeRating(a);

    return {
      nickname: a.nickname,
      teamKey: a.teamKey,
      tradeKills: a.tradeKills,
      tradedDeaths: a.tradedDeaths,
      untradedDeaths: a.untradedDeaths,
      rws: Math.round(avgRws * 100) / 100,
      playerId: a.steamId || undefined,
      steamId: a.steamId || undefined,
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      headshots: a.headshots,
      adr:
        a.roundsPlayed > 0
          ? Math.round((a.totalDamage / a.roundsPlayed) * 10) / 10
          : 0,
      hsPercent,
      damage: a.totalDamage,
      entryKills: a.entryKills,
      entryDeaths: a.entryDeaths,
      openingDuelAttempts: a.openingDuelAttempts,
      openingDuelWins: a.openingDuelWins,
      exitKills: a.exitKills,
      clutchAttempts: a.clutchAttempts,
      clutchWins: a.clutchWins,
      lastAliveRounds: a.lastAliveRounds,
      bombPlants: a.bombPlants,
      bombDefuses: a.bombDefuses,
      utilityDamage: a.utilityDamage,
      flashAssists: a.flashAssists,
      enemiesFlashed: a.enemiesFlashed,
      kastPercent,
      rating,
      multiKills: a.multiKills,
      killTimings: a.killTimings,
      ...(utilityMastery.get(a.steamId) ?? {}),
      ...(killQuality.get(a.steamId) ?? {}),
      ...(economy.get(a.steamId) ?? {}),
      ...(sideSplit.get(a.steamId) ?? {}),
    };
  });

  // ---- Build team analytics ----
  const team1Players = [...accums.values()].filter(
    (a) => a.teamKey === "team1"
  );
  const team2Players = [...accums.values()].filter(
    (a) => a.teamKey === "team2"
  );
  const team1RoundsWon = roundWinners.filter((w) => w === "team1").length;
  const team2RoundsWon = roundWinners.filter((w) => w === "team2").length;

  const teams: DemoTeamAnalytics[] = [
    buildTeamAnalytics(
      "team1",
      team1Players,
      team1Side,
      team1RoundsWon,
      team2RoundsWon
    ),
    buildTeamAnalytics(
      "team2",
      team2Players,
      team2Side,
      team2RoundsWon,
      team1RoundsWon
    ),
  ];

  return {
    matchId,
    sourceType,
    availability: "available",
    ingestionStatus: "parsed",
    mapName: parsed.header.mapName,
    totalRounds,
    teams,
    players,
    rounds: roundAnalytics,
  };
}

function buildTeamAnalytics(
  teamKey: DemoTeamKey,
  players: PlayerAccum[],
  side: "CT" | "T",
  roundsWon: number,
  roundsLost: number
): DemoTeamAnalytics {
  const totalTradeKills = players.reduce((s, p) => s + p.tradeKills, 0);
  const totalUntradedDeaths = players.reduce((s, p) => s + p.untradedDeaths, 0);
  const avgRws =
    players.length > 0
      ? players.reduce((s, p) => {
          const avg =
            p.rwsValues.length > 0
              ? p.rwsValues.reduce((a, b) => a + b, 0) / p.rwsValues.length
              : 0;
          return s + avg;
        }, 0) / players.length
      : 0;

  return {
    teamKey,
    name:
      players
        .map((p) => p.nickname)
        .join(", ")
        .slice(0, 50) || `Team ${teamKey === "team1" ? "1" : "2"}`,
    side,
    roundsWon,
    roundsLost,
    tradeKills: totalTradeKills,
    untradedDeaths: totalUntradedDeaths,
    rws: Math.round(avgRws * 100) / 100,
  };
}
