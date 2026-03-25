/**
 * Rich demo analytics builder — implements cs2_demo_analysis_rules.md
 *
 * Converts raw ParsedDemoFile events into full DemoMatchAnalytics
 * with all metrics: economy, clutches, exit kills, last alive,
 * opening duels, KAST%, kill timing, HS%, flash assists, utility damage,
 * weapon accuracy, post-plant, multi-kills, composite rating, streaks.
 */

import type {
  DemoAnalyticsSourceType,
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  DemoTeamKey,
} from "~/lib/types";
import {
  buildRoundScoreProgression,
  buildWinLossStreaks,
  computeRwsForRound,
} from "~/lib/demo-analytics";
import type {
  ParsedDemoBlind,
  ParsedDemoBombEvent,
  ParsedDemoFile,
  ParsedDemoHurt,
  ParsedDemoKill,
  ParsedDemoPlayer,
  ParsedDemoRound,
  ParsedDemoRoundTiming,
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
  "ak47", "aug", "awp", "famas", "g3sg1", "galilar",
  "m4a1", "m4a1_silencer", "scar20", "sg556",
]);
const HEAVIES = new Set(["negev", "m249"]);
const SMGS = new Set(["mac10", "mp5sd", "mp7", "mp9", "bizon", "p90", "ump45"]);
const SHOTGUNS = new Set(["mag7", "nova", "sawedoff", "xm1014"]);
const UTILITY_WEAPONS = new Set(["hegrenade", "molotov", "incgrenade", "inferno"]);
const KNIVES_AND_GRENADES = new Set([
  "knife", "knife_tactical", "knife_butterfly", "knife_karambit",
  "knife_falchion", "knife_flip", "knife_gut", "knife_m9_bayonet",
  "knife_bayonet", "knife_push", "knife_survival_bowie", "knife_ursus",
  "knife_widowmaker", "knife_stiletto", "knife_gypsy_jackknife",
  "knife_css", "knife_cord", "knife_canis", "knife_outdoor", "knife_skeleton",
  "hegrenade", "flashbang", "smokegrenade", "molotov", "incgrenade",
  "decoy", "inferno", "c4",
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

function buildSteamIdToTeamKey(players: ParsedDemoPlayer[]): Map<string, DemoTeamKey> {
  const map = new Map<string, DemoTeamKey>();
  for (const p of players) {
    if (!p.steamId) continue;
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
  kills: ParsedDemoKill[],
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
      if (team === "team1") team1Kills++;
      else if (team === "team2") team2Kills++;
    }
    if (team1Kills > team2Kills) {
      if (winnerSide === "CT") team1AsCT++;
      else if (winnerSide === "T") team1AsT++;
    } else if (team2Kills > team1Kills) {
      if (winnerSide === "CT") team1AsT++;
      else if (winnerSide === "T") team1AsCT++;
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
  team1FirstHalfSide: "CT" | "T",
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
    const tTeamKey: DemoTeamKey = team1FirstHalfSide === "T" ? "team2" : "team1";
    return { tTeamKey, ctTeamKey: tTeamKey === "team1" ? "team2" : "team1" };
  }
  const tTeamKey: DemoTeamKey = team1FirstHalfSide === "T" ? "team1" : "team2";
  return { tTeamKey, ctTeamKey: tTeamKey === "team1" ? "team2" : "team1" };
}

function mapRoundWinnerToTeamKey(
  winnerSide: string | null,
  roundNumber: number,
  totalRounds: number,
  team1FirstHalfSide: "CT" | "T",
): DemoTeamKey | null {
  if (!winnerSide || (winnerSide !== "CT" && winnerSide !== "T")) return null;
  const { tTeamKey, ctTeamKey } = getTeamSidesForRound(roundNumber, totalRounds, team1FirstHalfSide);
  return winnerSide === "T" ? tTeamKey : ctTeamKey;
}

// ---------------------------------------------------------------------------
// Economy classification (from weapon_fire events)
// ---------------------------------------------------------------------------

type BuyType = "full_buy" | "force_buy" | "eco" | "unknown";

function classifyTeamBuy(
  weaponFires: ParsedDemoWeaponFire[],
  teamSteamIds: Set<string>,
): BuyType {
  let hasRifleOrHeavy = false;
  let hasSmgOrShotgun = false;

  for (const fire of weaponFires) {
    if (!teamSteamIds.has(fire.playerSteamId)) continue;
    const w = stripWeaponPrefix(fire.weapon);
    if (isKnifeOrGrenade(fire.weapon)) continue;
    if (RIFLES.has(w) || HEAVIES.has(w)) { hasRifleOrHeavy = true; break; }
    if (SMGS.has(w) || SHOTGUNS.has(w)) hasSmgOrShotgun = true;
  }

  if (hasRifleOrHeavy) return "full_buy";
  if (hasSmgOrShotgun) return "force_buy";
  return "eco";
}

// ---------------------------------------------------------------------------
// Trade kills
// ---------------------------------------------------------------------------

interface TradeResult {
  tradeKills: Map<string, number>;
  tradedDeaths: Map<string, number>;
  untradedDeaths: Map<string, number>;
}

function computeTrades(
  roundKills: ParsedDemoKill[],
  steamToTeam: Map<string, DemoTeamKey>,
): TradeResult {
  const tradeKills = new Map<string, number>();
  const tradedDeaths = new Map<string, number>();
  const untradedDeaths = new Map<string, number>();
  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (let i = 0; i < sorted.length; i++) {
    const death = sorted[i];
    const victimTeam = steamToTeam.get(death.victimSteamId);
    if (!victimTeam) continue;

    let traded = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (next.tick - death.tick > TRADE_WINDOW_TICKS) break;
      const nextKillerTeam = steamToTeam.get(next.attackerSteamId);
      const nextVictimTeam = steamToTeam.get(next.victimSteamId);
      if (nextKillerTeam === victimTeam && nextVictimTeam !== victimTeam) {
        traded = true;
        tradeKills.set(next.attackerSteamId, (tradeKills.get(next.attackerSteamId) ?? 0) + 1);
        tradedDeaths.set(death.victimSteamId, (tradedDeaths.get(death.victimSteamId) ?? 0) + 1);
        break;
      }
    }
    if (!traded) {
      untradedDeaths.set(death.victimSteamId, (untradedDeaths.get(death.victimSteamId) ?? 0) + 1);
    }
  }

  return { tradeKills, tradedDeaths, untradedDeaths };
}

// ---------------------------------------------------------------------------
// Clutch detection
// ---------------------------------------------------------------------------

interface ClutchInfo {
  playerSteamId: string;
  teamKey: DemoTeamKey;
  vs: number;
  won: boolean;
  killsDuringClutch: number;
}

function detectClutch(
  roundKills: ParsedDemoKill[],
  allSteamIds: string[],
  steamToTeam: Map<string, DemoTeamKey>,
  roundWinner: DemoTeamKey | null,
): ClutchInfo | null {
  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set("team1", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1")));
  alive.set("team2", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2")));

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);
  let clutchPlayer: string | null = null;
  let clutchTeam: DemoTeamKey | null = null;
  let clutchVs = 0;
  let clutchStartIdx = -1;

  for (let i = 0; i < sorted.length; i++) {
    const kill = sorted[i];
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) alive.get(victimTeam)?.delete(kill.victimSteamId);

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

  if (!clutchPlayer || !clutchTeam) return null;

  const killsDuringClutch = sorted
    .slice(clutchStartIdx)
    .filter((k) => k.attackerSteamId === clutchPlayer)
    .length;

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
  roundWinner: DemoTeamKey | null,
): Set<number> {
  const exitKillIndices = new Set<number>();
  if (!roundWinner) return exitKillIndices;

  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set("team1", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1")));
  alive.set("team2", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2")));

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (let i = 0; i < sorted.length; i++) {
    const kill = sorted[i];
    const attackerTeam = steamToTeam.get(kill.attackerSteamId);
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) alive.get(victimTeam)?.delete(kill.victimSteamId);

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
  steamToTeam: Map<string, DemoTeamKey>,
): string | null {
  const alive = new Map<DemoTeamKey, Set<string>>();
  alive.set("team1", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1")));
  alive.set("team2", new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2")));

  const sorted = [...roundKills].sort((a, b) => a.tick - b.tick);

  for (const kill of sorted) {
    const victimTeam = steamToTeam.get(kill.victimSteamId);
    if (victimTeam) alive.get(victimTeam)?.delete(kill.victimSteamId);

    for (const [, teamAlive] of alive) {
      if (teamAlive.size === 1) return [...teamAlive][0];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Opening duel (first kill of each round)
// ---------------------------------------------------------------------------

function getOpeningDuel(roundKills: ParsedDemoKill[]): ParsedDemoKill | null {
  if (roundKills.length === 0) return null;
  return roundKills.reduce((earliest, k) => (k.tick < earliest.tick ? k : earliest));
}

// ---------------------------------------------------------------------------
// Kill timing classification
// ---------------------------------------------------------------------------

type KillTiming = "early" | "mid" | "late";

function classifyKillTiming(killTick: number, freezeEndTick: number): KillTiming {
  const seconds = (killTick - freezeEndTick) / CS2_TICK_RATE;
  if (seconds <= KILL_TIMING_EARLY_SEC) return "early";
  if (seconds <= KILL_TIMING_MID_SEC) return "mid";
  return "late";
}

// ---------------------------------------------------------------------------
// Composite rating (approximation of HLTV 2.0)
// ---------------------------------------------------------------------------

function computeRating(a: PlayerAccum): number {
  if (a.roundsPlayed === 0) return 0;

  const kpr = a.kills / a.roundsPlayed;
  const dpr = a.deaths / a.roundsPlayed;
  const adrFactor = (a.totalDamage / a.roundsPlayed) / 151.5;
  const kastFactor = a.kastRounds / a.roundsPlayed;
  const impact = (a.entryKills + a.clutchWins * 2) / a.roundsPlayed;

  const rating =
    0.25 * kpr * 3.0 +
    0.20 * (1 - dpr * 1.2) +
    0.20 * adrFactor +
    0.20 * kastFactor +
    0.15 * impact * 2.0;

  return Math.round(rating * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-player accumulator
// ---------------------------------------------------------------------------

interface PlayerAccum {
  steamId: string;
  nickname: string;
  teamKey: DemoTeamKey;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  totalDamage: number;
  utilityDamage: number;
  tradeKills: number;
  tradedDeaths: number;
  untradedDeaths: number;
  entryKills: number;
  entryDeaths: number;
  openingDuelAttempts: number;
  openingDuelWins: number;
  exitKills: number;
  clutchAttempts: number;
  clutchWins: number;
  lastAliveRounds: number;
  bombPlants: number;
  bombDefuses: number;
  flashAssists: number;
  enemiesFlashed: number;
  rwsValues: number[];
  multiKills: { threeK: number; fourK: number; ace: number };
  killTimings: { early: number; mid: number; late: number };
  kastRounds: number;
  roundsPlayed: number;
}

function emptyAccum(steamId: string, nickname: string, teamKey: DemoTeamKey): PlayerAccum {
  return {
    steamId, nickname, teamKey,
    kills: 0, deaths: 0, assists: 0, headshots: 0,
    totalDamage: 0, utilityDamage: 0,
    tradeKills: 0, tradedDeaths: 0, untradedDeaths: 0,
    entryKills: 0, entryDeaths: 0, openingDuelAttempts: 0, openingDuelWins: 0,
    exitKills: 0, clutchAttempts: 0, clutchWins: 0, lastAliveRounds: 0,
    bombPlants: 0, bombDefuses: 0, flashAssists: 0, enemiesFlashed: 0,
    rwsValues: [], multiKills: { threeK: 0, fourK: 0, ace: 0 },
    killTimings: { early: 0, mid: 0, late: 0 }, kastRounds: 0, roundsPlayed: 0,
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildRichDemoAnalytics(
  matchId: string,
  sourceType: DemoAnalyticsSourceType,
  parsed: ParsedDemoFile,
): DemoMatchAnalytics {
  const steamToTeam = buildSteamIdToTeamKey(parsed.playerInfo.players);
  const allSteamIds = parsed.playerInfo.players.map((p) => p.steamId).filter(Boolean);
  const team1SteamIds = new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team1"));
  const team2SteamIds = new Set(allSteamIds.filter((id) => steamToTeam.get(id) === "team2"));

  const { team1Side, team2Side } = detectFirstHalfSides(parsed.rounds, steamToTeam, parsed.kills);
  const totalRounds = parsed.rounds.length;

  // Group events by round
  const killsByRound = groupBy(parsed.kills, (k) => k.roundNumber);
  const hurtsByRound = groupBy(parsed.hurts, (h) => h.roundNumber);
  const bombsByRound = groupBy(parsed.bombEvents, (b) => b.roundNumber);
  const firesByRound = groupBy(parsed.weaponFires, (f) => f.roundNumber);
  const blindsByRound = groupBy(parsed.blinds, (b) => b.roundNumber);
  const timingByRound = new Map(parsed.roundTimings.map((t) => [t.roundNumber, t.freezeEndTick]));

  // Player accumulators
  const accums = new Map<string, PlayerAccum>();
  for (const p of parsed.playerInfo.players) {
    if (!p.steamId) continue;
    accums.set(p.steamId, emptyAccum(p.steamId, p.nickname, steamToTeam.get(p.steamId) ?? "team1"));
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

    const winnerSide = typeof round.winner === "string" ? round.winner as "CT" | "T" : null;
    const winnerTeamKey = mapRoundWinnerToTeamKey(winnerSide, rn, totalRounds, team1Side);
    roundWinners.push(winnerTeamKey);

    const { tTeamKey, ctTeamKey } = getTeamSidesForRound(rn, totalRounds, team1Side);
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
        roundPlayerDamage.set(h.attackerSteamId, (roundPlayerDamage.get(h.attackerSteamId) ?? 0) + h.damage);
        const w = stripWeaponPrefix(h.weapon);
        if (UTILITY_WEAPONS.has(w)) {
          roundPlayerUtilDamage.set(h.attackerSteamId, (roundPlayerUtilDamage.get(h.attackerSteamId) ?? 0) + h.damage);
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
      if (k.attackerSteamId) roundPlayerKills.set(k.attackerSteamId, (roundPlayerKills.get(k.attackerSteamId) ?? 0) + 1);
      if (k.victimSteamId) {
        roundPlayerDeaths.set(k.victimSteamId, (roundPlayerDeaths.get(k.victimSteamId) ?? 0) + 1);
        deadThisRound.add(k.victimSteamId);
      }
      if (k.assisterSteamId) roundPlayerAssists.add(k.assisterSteamId);
      if (k.headshot && k.attackerSteamId) roundPlayerHeadshots.set(k.attackerSteamId, (roundPlayerHeadshots.get(k.attackerSteamId) ?? 0) + 1);
    }

    // Trades
    const trades = computeTrades(roundKills, steamToTeam);

    // Opening duel
    const openingKill = getOpeningDuel(roundKills);

    // Clutch
    const clutch = detectClutch(roundKills, allSteamIds, steamToTeam, winnerTeamKey);

    // Exit kills
    const exitKillIndices = detectExitKills(roundKills, allSteamIds, steamToTeam, winnerTeamKey);

    // Last alive
    const lastAlivePlayer = detectLastAlive(roundKills, allSteamIds, steamToTeam);

    // Flash assists (from kill events) and enemy flashed (from blind events)
    for (const k of roundKills) {
      if (k.assistedFlash && k.assisterSteamId) {
        const a = accums.get(k.assisterSteamId);
        if (a) a.flashAssists++;
      }
    }
    for (const b of roundBlinds) {
      const flasherTeam = steamToTeam.get(b.attackerSteamId);
      const blindedTeam = steamToTeam.get(b.victimSteamId);
      if (flasherTeam && blindedTeam && flasherTeam !== blindedTeam) {
        const a = accums.get(b.attackerSteamId);
        if (a) a.enemiesFlashed++;
      }
    }

    // Bomb plants/defuses
    if (planted) {
      const a = accums.get(planted.playerSteamId);
      if (a) a.bombPlants++;
    }
    if (defused) {
      const a = accums.get(defused.playerSteamId);
      if (a) a.bombDefuses++;
    }

    // RWS
    const rwsPlayers = allSteamIds.map((id) => ({
      playerId: id,
      teamKey: steamToTeam.get(id) ?? "team1" as DemoTeamKey,
      damage: roundPlayerDamage.get(id) ?? 0,
      alive: !deadThisRound.has(id),
    }));
    const bombBonusPlayerId = planted
      ? (round.reason === "bomb_exploded" ? planted.playerSteamId : null)
        ?? (defused ? defused.playerSteamId : null)
      : null;
    const roundRws = computeRwsForRound({
      winningTeamKey: winnerTeamKey,
      bombBonusPlayerId,
      players: rwsPlayers,
    });

    // Kill timing classification
    const killTimingMap = new Map<number, KillTiming>();
    for (let i = 0; i < sortedKills.length; i++) {
      killTimingMap.set(i, classifyKillTiming(sortedKills[i].tick, freezeEndTick));
    }

    // ---- Accumulate per-player stats ----
    for (const [steamId, a] of accums) {
      a.roundsPlayed++;
      a.kills += roundPlayerKills.get(steamId) ?? 0;
      a.deaths += roundPlayerDeaths.get(steamId) ?? 0;
      if (roundPlayerAssists.has(steamId)) a.assists++;
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
        if (clutch.won) a.clutchWins++;
      }

      // Exit kills
      for (const idx of exitKillIndices) {
        if (sortedKills[idx].attackerSteamId === steamId) a.exitKills++;
      }

      // Last alive
      if (lastAlivePlayer === steamId) a.lastAliveRounds++;

      // Kill timing
      for (let i = 0; i < sortedKills.length; i++) {
        if (sortedKills[i].attackerSteamId === steamId) {
          const timing = killTimingMap.get(i)!;
          a.killTimings[timing]++;
        }
      }

      // Multi-kills
      const rKills = roundPlayerKills.get(steamId) ?? 0;
      if (rKills === 3) a.multiKills.threeK++;
      else if (rKills === 4) a.multiKills.fourK++;
      else if (rKills >= 5) a.multiKills.ace++;

      // KAST: Kill, Assist, Survived, Traded
      const hasKill = (roundPlayerKills.get(steamId) ?? 0) > 0;
      const hasAssist = roundPlayerAssists.has(steamId);
      const survived = !deadThisRound.has(steamId);
      const wasTraded = (trades.tradedDeaths.get(steamId) ?? 0) > 0;
      if (hasKill || hasAssist || survived || wasTraded) a.kastRounds++;
    }

    // ---- Build round analytics ----
    const scoreProgression = buildRoundScoreProgression(roundWinners);
    const lastScore = scoreProgression[scoreProgression.length - 1]?.scoreAfterRound ?? { team1: 0, team2: 0 };

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
    });
  }

  // Fix score progression: use buildRoundScoreProgression on all round winners
  const fullScoreProgression = buildRoundScoreProgression(roundWinners);
  for (let i = 0; i < roundAnalytics.length; i++) {
    roundAnalytics[i].scoreAfterRound = fullScoreProgression[i]?.scoreAfterRound ?? { team1: 0, team2: 0 };
  }

  // ---- Build player analytics ----
  const streaks = buildWinLossStreaks(roundWinners);

  const players: DemoPlayerAnalytics[] = [...accums.values()].map((a) => {
    const avgRws = a.rwsValues.length > 0
      ? a.rwsValues.reduce((s, v) => s + v, 0) / a.rwsValues.length
      : 0;
    const hsPercent = a.kills > 0 ? Math.round((a.headshots / a.kills) * 1000) / 10 : 0;
    const kastPercent = a.roundsPlayed > 0 ? Math.round((a.kastRounds / a.roundsPlayed) * 1000) / 10 : 0;
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
      adr: a.roundsPlayed > 0 ? Math.round((a.totalDamage / a.roundsPlayed) * 10) / 10 : 0,
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
    };
  });

  // ---- Build team analytics ----
  const team1Players = [...accums.values()].filter((a) => a.teamKey === "team1");
  const team2Players = [...accums.values()].filter((a) => a.teamKey === "team2");
  const team1RoundsWon = roundWinners.filter((w) => w === "team1").length;
  const team2RoundsWon = roundWinners.filter((w) => w === "team2").length;

  const teams: DemoTeamAnalytics[] = [
    buildTeamAnalytics("team1", team1Players, team1Side, team1RoundsWon, team2RoundsWon),
    buildTeamAnalytics("team2", team2Players, team2Side, team2RoundsWon, team1RoundsWon),
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
  roundsLost: number,
): DemoTeamAnalytics {
  const totalTradeKills = players.reduce((s, p) => s + p.tradeKills, 0);
  const totalUntradedDeaths = players.reduce((s, p) => s + p.untradedDeaths, 0);
  const avgRws = players.length > 0
    ? players.reduce((s, p) => {
        const avg = p.rwsValues.length > 0 ? p.rwsValues.reduce((a, b) => a + b, 0) / p.rwsValues.length : 0;
        return s + avg;
      }, 0) / players.length
    : 0;

  return {
    teamKey,
    name: players.map((p) => p.nickname).join(", ").slice(0, 50) || `Team ${teamKey === "team1" ? "1" : "2"}`,
    side,
    roundsWon,
    roundsLost,
    tradeKills: totalTradeKills,
    untradedDeaths: totalUntradedDeaths,
    rws: Math.round(avgRws * 100) / 100,
  };
}
