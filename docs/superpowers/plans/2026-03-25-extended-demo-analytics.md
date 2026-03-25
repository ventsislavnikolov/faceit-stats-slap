# Extended Demo Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Economy Intelligence, Utility Mastery, Kill Quality, and Side-Split Performance stats to the CS2 demo analytics pipeline and match page UI.

**Architecture:** Extend the existing vertical slice: parser extracts new events → builder computes new metrics → store persists to DB → read path deserializes → UI displays. 4 new pure compute functions in the builder, 26 new DB columns, 3 new UI sections.

**Tech Stack:** TypeScript, @laihoe/demoparser2, Supabase (PostgreSQL), React, recharts, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-extended-demo-analytics-design.md`

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/008_extended_demo_analytics.sql`

- [ ] **Step 1: Write migration**

```sql
-- 008_extended_demo_analytics.sql
-- Adds utility mastery, kill quality, economy, and side-split columns

-- Utility mastery
ALTER TABLE demo_player_analytics ADD COLUMN smokes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN flashes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN hes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN molotovs_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN utility_per_round numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN avg_flash_blind_duration numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN team_flashes int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN effective_flash_rate numeric NOT NULL DEFAULT 0;

-- Kill quality
ALTER TABLE demo_player_analytics ADD COLUMN wallbang_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN thrusmoke_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN noscope_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN avg_kill_distance numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN weapon_kills jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Economy
ALTER TABLE demo_player_analytics ADD COLUMN total_spend int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN economy_efficiency numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN weapon_rounds jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Side-split
ALTER TABLE demo_player_analytics ADD COLUMN ct_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_deaths int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_adr numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_rating numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_deaths int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_adr numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_rating numeric NOT NULL DEFAULT 0;

-- Round equip values
ALTER TABLE demo_round_analytics ADD COLUMN t_equip_value int NOT NULL DEFAULT 0;
ALTER TABLE demo_round_analytics ADD COLUMN ct_equip_value int NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run: `mcp__plugin_supabase_supabase__apply_migration` with the SQL above and migration name `extended_demo_analytics`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_extended_demo_analytics.sql
git commit -m "feat(schema): add extended demo analytics columns"
```

---

## Task 2: Extend Types

**Files:**
- Modify: `src/lib/types.ts:144-206` (DemoPlayerAnalytics, DemoRoundAnalytics)

- [ ] **Step 1: Add utility mastery fields to DemoPlayerAnalytics**

After line 176 (`killTimings?`), add:

```ts
  // Utility mastery
  smokesThrown?: number;
  flashesThrown?: number;
  hesThrown?: number;
  molotovsThrown?: number;
  utilityPerRound?: number;
  avgFlashBlindDuration?: number;
  teamFlashes?: number;
  effectiveFlashRate?: number;
```

- [ ] **Step 2: Add kill quality fields**

```ts
  // Kill quality
  wallbangKills?: number;
  thrusmokeKills?: number;
  noscopeKills?: number;
  avgKillDistance?: number;
  weaponKills?: Record<string, number>;
```

- [ ] **Step 3: Add economy fields**

```ts
  // Economy
  totalSpend?: number;
  economyEfficiency?: number;
  weaponRounds?: Record<string, number>;
```

- [ ] **Step 4: Add side-split fields**

```ts
  // Side-split
  ctKills?: number;
  ctDeaths?: number;
  ctAdr?: number;
  ctRating?: number;
  tKills?: number;
  tDeaths?: number;
  tAdr?: number;
  tRating?: number;
```

- [ ] **Step 5: Add equip value fields to DemoRoundAnalytics**

After line 205 (`defuserSteamId?`), add:

```ts
  tEquipValue?: number;
  ctEquipValue?: number;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add extended demo analytics fields"
```

---

## Task 3: Extend Parser — New Events and Kill Fields

**Files:**
- Modify: `src/server/demo-parser.ts`

- [ ] **Step 1: Add new event names to DEMO_EVENT_NAMES**

In `demo-parser.ts:19-30`, add to the array:

```ts
  "item_purchase",
  "smokegrenade_detonate",
  "flashbang_detonate",
  "hegrenade_detonate",
  "inferno_startburn",
```

- [ ] **Step 2: Add new parser types**

After `ParsedDemoRoundTiming` (line 114), add:

```ts
export interface ParsedDemoItemPurchase {
  tick: number;
  roundNumber: number;
  steamId: string;
  nickname: string;
  itemName: string;
  cost: number;
}

export interface ParsedDemoGrenadeDetonate {
  tick: number;
  roundNumber: number;
  steamId: string;
  nickname: string;
  type: "smoke" | "flash" | "he" | "molotov";
  x: number;
  y: number;
  z: number;
}
```

- [ ] **Step 3: Extend ParsedDemoKill with noscope and distance**

Add to `ParsedDemoKill` interface (after line 76):

```ts
  noscope: boolean;
  distance: number;
```

- [ ] **Step 4: Extend ParsedDemoFile with new arrays**

Add to `ParsedDemoFile` interface (after `roundTimings`):

```ts
  itemPurchases: ParsedDemoItemPurchase[];
  grenadeDetonates: ParsedDemoGrenadeDetonate[];
```

- [ ] **Step 5: Extend normalizeKills to capture noscope and distance**

In `normalizeKills` (line 222-240), add to the map return object:

```ts
      noscope: Boolean(e.noscope),
      distance: Number(e.distance ?? 0),
```

- [ ] **Step 6: Add normalizeItemPurchases function**

```ts
function normalizeItemPurchases(events: RawDemoEvent[]): ParsedDemoItemPurchase[] {
  return events
    .filter((e) => e.event_name === "item_purchase" && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      steamId: String(e.steamid ?? ""),
      nickname: String(e.name ?? ""),
      itemName: String(e.item_name ?? ""),
      cost: Number(e.cost ?? 0),
    }));
}
```

- [ ] **Step 7: Add normalizeGrenadeDetonates function**

```ts
const GRENADE_EVENT_TO_TYPE: Record<string, ParsedDemoGrenadeDetonate["type"]> = {
  smokegrenade_detonate: "smoke",
  flashbang_detonate: "flash",
  hegrenade_detonate: "he",
  inferno_startburn: "molotov",
};

function normalizeGrenadeDetonates(events: RawDemoEvent[]): ParsedDemoGrenadeDetonate[] {
  return events
    .filter((e) => e.event_name && e.event_name in GRENADE_EVENT_TO_TYPE && typeof e.total_rounds_played === "number" && e.total_rounds_played > 0)
    .map((e) => ({
      tick: Number(e.tick ?? 0),
      roundNumber: Number(e.total_rounds_played),
      steamId: String(e.user_steamid ?? ""),
      nickname: String(e.user_name ?? ""),
      type: GRENADE_EVENT_TO_TYPE[e.event_name!]!,
      x: Number(e.x ?? 0),
      y: Number(e.y ?? 0),
      z: Number(e.z ?? 0),
    }));
}
```

- [ ] **Step 8: Wire new normalizers into parseDemoFile**

In `parseDemoFile` return object (line 366-376), add:

```ts
    itemPurchases: normalizeItemPurchases(rawEvents),
    grenadeDetonates: normalizeGrenadeDetonates(rawEvents),
```

- [ ] **Step 9: Verify with real demo**

Run:
```bash
set -a && source .env.local && set +a && npx tsx -e '
import { parseDemoFile } from "~/server/demo-parser";
const parsed = await parseDemoFile("/Users/ventsislav.nikolov/Downloads/1-56d10dbb-e90c-4b5a-95ea-b9572df1749b-1-1.dem.zst");
console.log("Item purchases:", parsed.itemPurchases.length);
console.log("Grenade detonates:", parsed.grenadeDetonates.length);
console.log("Sample kill noscope:", parsed.kills[0]?.noscope, "distance:", parsed.kills[0]?.distance);
console.log("Smoke/Flash/HE/Molo:",
  parsed.grenadeDetonates.filter(g => g.type === "smoke").length,
  parsed.grenadeDetonates.filter(g => g.type === "flash").length,
  parsed.grenadeDetonates.filter(g => g.type === "he").length,
  parsed.grenadeDetonates.filter(g => g.type === "molotov").length
);
'
```

Expected: item_purchase ~1593, grenadeDetonates ~437 (125+106+111+95), noscope=false/true, distance=number.

- [ ] **Step 10: Commit**

```bash
git add src/server/demo-parser.ts
git commit -m "feat(parser): extract item purchases, grenade detonates, kill quality fields"
```

---

## Task 4: Builder — Utility Mastery

**Files:**
- Modify: `src/server/demo-analytics-builder.ts`

- [ ] **Step 1: Write computeUtilityMastery function**

Add after the existing helper functions (after `classifyKillTiming`):

```ts
interface UtilityMasteryResult {
  smokesThrown: number;
  flashesThrown: number;
  hesThrown: number;
  molotovsThrown: number;
  utilityPerRound: number;
  avgFlashBlindDuration: number;
  teamFlashes: number;
  effectiveFlashRate: number;
}

function computeUtilityMastery(
  grenadeDetonates: ParsedDemoGrenadeDetonate[],
  blinds: ParsedDemoBlind[],
  steamToTeam: Map<string, DemoTeamKey>,
  totalRounds: number,
): Map<string, UtilityMasteryResult> {
  const result = new Map<string, UtilityMasteryResult>();

  // Count grenades per player per type
  for (const g of grenadeDetonates) {
    if (!g.steamId) continue;
    let entry = result.get(g.steamId);
    if (!entry) {
      entry = { smokesThrown: 0, flashesThrown: 0, hesThrown: 0, molotovsThrown: 0, utilityPerRound: 0, avgFlashBlindDuration: 0, teamFlashes: 0, effectiveFlashRate: 0 };
      result.set(g.steamId, entry);
    }
    if (g.type === "smoke") entry.smokesThrown++;
    else if (g.type === "flash") entry.flashesThrown++;
    else if (g.type === "he") entry.hesThrown++;
    else if (g.type === "molotov") entry.molotovsThrown++;
  }

  // Flash blind duration and team flashes
  const blindsByAttacker = new Map<string, ParsedDemoBlind[]>();
  for (const b of blinds) {
    const arr = blindsByAttacker.get(b.attackerSteamId) ?? [];
    arr.push(b);
    blindsByAttacker.set(b.attackerSteamId, arr);
  }

  for (const [steamId, entry] of result) {
    const totalUtil = entry.smokesThrown + entry.flashesThrown + entry.hesThrown + entry.molotovsThrown;
    entry.utilityPerRound = totalRounds > 0 ? Math.round((totalUtil / totalRounds) * 10) / 10 : 0;

    const playerBlinds = blindsByAttacker.get(steamId) ?? [];
    const flasherTeam = steamToTeam.get(steamId);

    // Avg flash blind duration (enemy blinds only)
    const enemyBlinds = playerBlinds.filter(b => steamToTeam.get(b.victimSteamId) !== flasherTeam);
    if (enemyBlinds.length > 0) {
      entry.avgFlashBlindDuration = Math.round((enemyBlinds.reduce((s, b) => s + b.duration, 0) / enemyBlinds.length) * 100) / 100;
    }

    // Team flashes
    entry.teamFlashes = playerBlinds.filter(b => {
      const blindedTeam = steamToTeam.get(b.victimSteamId);
      return flasherTeam && blindedTeam && flasherTeam === blindedTeam;
    }).length;

    // Effective flash rate: % of flash detonates that blinded at least one enemy
    if (entry.flashesThrown > 0) {
      const flashDetonates = grenadeDetonates.filter(g => g.type === "flash" && g.steamId === steamId);
      let effectiveFlashes = 0;
      for (const fd of flashDetonates) {
        const hasEnemyBlind = playerBlinds.some(b =>
          Math.abs(b.tick - fd.tick) <= 64 &&
          steamToTeam.get(b.victimSteamId) !== flasherTeam
        );
        if (hasEnemyBlind) effectiveFlashes++;
      }
      entry.effectiveFlashRate = Math.round((effectiveFlashes / entry.flashesThrown) * 100);
    }
  }

  return result;
}
```

- [ ] **Step 2: Import ParsedDemoGrenadeDetonate type**

Add to the import from `~/server/demo-parser`:

```ts
  ParsedDemoGrenadeDetonate,
  ParsedDemoItemPurchase,
```

- [ ] **Step 3: Wire into buildRichDemoAnalytics**

After the round processing loop (after line 719, before building player analytics), add:

```ts
  // Extended analytics: utility mastery
  const utilityMastery = computeUtilityMastery(
    parsed.grenadeDetonates ?? [],
    parsed.blinds,
    steamToTeam,
    totalRounds,
  );
```

Then in the player analytics map (line 738 return), spread utility mastery:

```ts
      ...(utilityMastery.get(a.steamId) ?? {}),
```

- [ ] **Step 4: Commit**

```bash
git add src/server/demo-analytics-builder.ts
git commit -m "feat(builder): add utility mastery computation"
```

---

## Task 5: Builder — Kill Quality

**Files:**
- Modify: `src/server/demo-analytics-builder.ts`

- [ ] **Step 1: Write computeKillQuality function**

```ts
interface KillQualityResult {
  wallbangKills: number;
  thrusmokeKills: number;
  noscopeKills: number;
  avgKillDistance: number;
  weaponKills: Record<string, number>;
}

function computeKillQuality(kills: ParsedDemoKill[]): Map<string, KillQualityResult> {
  const result = new Map<string, KillQualityResult>();

  for (const k of kills) {
    if (!k.attackerSteamId) continue;
    let entry = result.get(k.attackerSteamId);
    if (!entry) {
      entry = { wallbangKills: 0, thrusmokeKills: 0, noscopeKills: 0, avgKillDistance: 0, weaponKills: {} };
      result.set(k.attackerSteamId, entry);
    }
    if (k.penetrated) entry.wallbangKills++;
    if (k.thruSmoke) entry.thrusmokeKills++;
    if (k.noscope) entry.noscopeKills++;
    const weapon = stripWeaponPrefix(k.weapon);
    entry.weaponKills[weapon] = (entry.weaponKills[weapon] ?? 0) + 1;
  }

  // Compute avg distance per player
  for (const [steamId, entry] of result) {
    const playerKills = kills.filter(k => k.attackerSteamId === steamId && k.distance > 0);
    if (playerKills.length > 0) {
      entry.avgKillDistance = Math.round((playerKills.reduce((s, k) => s + k.distance, 0) / playerKills.length) * 10) / 10;
    }
  }

  return result;
}
```

- [ ] **Step 2: Wire into buildRichDemoAnalytics**

After utility mastery computation:

```ts
  // Extended analytics: kill quality
  const killQuality = computeKillQuality(parsed.kills);
```

In player analytics map, spread:

```ts
      ...(killQuality.get(a.steamId) ?? {}),
```

- [ ] **Step 3: Commit**

```bash
git add src/server/demo-analytics-builder.ts
git commit -m "feat(builder): add kill quality computation"
```

---

## Task 6: Builder — Economy Intelligence

**Files:**
- Modify: `src/server/demo-analytics-builder.ts`

- [ ] **Step 1: Write computeEconomy function**

```ts
interface EconomyResult {
  totalSpend: number;
  economyEfficiency: number;
  weaponRounds: Record<string, number>;
}

// Reuse existing sets from top of file: RIFLES (includes awp), SMGS
const AWP_ITEMS = new Set(["awp"]);
// RIFLE_ITEMS = RIFLES minus AWP (already defined as RIFLES at top of file)
// SMG_ITEMS = SMGS (already defined at top of file)

function classifyWeaponRound(purchases: ParsedDemoItemPurchase[]): string {
  // item_purchase uses display names (e.g. "AK-47"), normalize to internal names for matching
  const weapons = purchases.map(p => p.itemName.toLowerCase().replace(/[- ]/g, ""));
  for (const w of weapons) {
    if (w === "awp") return "awp";
  }
  for (const p of purchases) {
    // Match by cost: rifles cost $2700+
    if (p.cost >= 2700) return "rifle";
  }
  for (const p of purchases) {
    // SMGs: $1050-$2350
    if (p.cost >= 1050 && p.cost < 2700) return "smg";
  }
  return "pistol";
}

function computeEconomy(
  itemPurchases: ParsedDemoItemPurchase[],
  totalDamageByPlayer: Map<string, number>,
  totalRounds: number,
): Map<string, EconomyResult> {
  const result = new Map<string, EconomyResult>();

  // Group purchases by player
  const byPlayer = new Map<string, ParsedDemoItemPurchase[]>();
  for (const p of itemPurchases) {
    if (!p.steamId) continue;
    const arr = byPlayer.get(p.steamId) ?? [];
    arr.push(p);
    byPlayer.set(p.steamId, arr);
  }

  for (const [steamId, purchases] of byPlayer) {
    const totalSpend = purchases.reduce((s, p) => s + p.cost, 0);
    const totalDamage = totalDamageByPlayer.get(steamId) ?? 0;
    const economyEfficiency = totalSpend > 0 ? Math.round((totalDamage / totalSpend) * 1000 * 10) / 10 : 0;

    // Weapon rounds: group purchases by round, classify each round
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
```

- [ ] **Step 2: Compute per-round equip values for rounds**

Add helper to compute team equip values per round:

```ts
function computeRoundEquipValues(
  itemPurchases: ParsedDemoItemPurchase[],
  steamToTeam: Map<string, DemoTeamKey>,
  roundNumber: number,
  tTeamKey: DemoTeamKey,
): { tEquipValue: number; ctEquipValue: number } {
  const roundPurchases = itemPurchases.filter(p => p.roundNumber === roundNumber);
  let tEquipValue = 0;
  let ctEquipValue = 0;
  for (const p of roundPurchases) {
    const team = steamToTeam.get(p.steamId);
    if (team === tTeamKey) tEquipValue += p.cost;
    else ctEquipValue += p.cost;
  }
  return { tEquipValue, ctEquipValue };
}
```

- [ ] **Step 3: Wire into buildRichDemoAnalytics**

After kill quality:

```ts
  // Extended analytics: economy
  const totalDamageByPlayer = new Map<string, number>();
  for (const a of accums.values()) {
    totalDamageByPlayer.set(a.steamId, a.totalDamage);
  }
  const economy = computeEconomy(parsed.itemPurchases ?? [], totalDamageByPlayer, totalRounds);
```

In player analytics spread:

```ts
      ...(economy.get(a.steamId) ?? {}),
```

In round analytics construction (inside the round loop), add equip values to roundAnalytics.push:

```ts
      ...computeRoundEquipValues(parsed.itemPurchases ?? [], steamToTeam, rn, tTeamKey),
```

- [ ] **Step 4: Commit**

```bash
git add src/server/demo-analytics-builder.ts
git commit -m "feat(builder): add economy intelligence computation"
```

---

## Task 7: Builder — Side-Split Performance

**Files:**
- Modify: `src/server/demo-analytics-builder.ts`

- [ ] **Step 1: Refactor computeRating to accept a stats slice**

Change `computeRating` signature to accept individual params instead of `PlayerAccum`:

```ts
interface RatingInput {
  kills: number;
  deaths: number;
  totalDamage: number;
  kastRounds: number;
  roundsPlayed: number;
  entryKills: number;
  clutchWins: number;
}

function computeRating(a: RatingInput): number {
  // same body — already only uses these fields
}
```

Update existing call site to pass `a` directly (no change needed since PlayerAccum has all these fields).

- [ ] **Step 2: Write computeSideSplit function**

```ts
interface SideSplitResult {
  ctKills: number;
  ctDeaths: number;
  ctAdr: number;
  ctRating: number;
  tKills: number;
  tDeaths: number;
  tAdr: number;
  tRating: number;
}

function computeSideSplit(
  kills: ParsedDemoKill[],
  hurts: ParsedDemoHurt[],
  rounds: ParsedDemoRound[],
  steamToTeam: Map<string, DemoTeamKey>,
  team1FirstHalfSide: "CT" | "T",
  allSteamIds: string[],
): Map<string, SideSplitResult> {
  const result = new Map<string, SideSplitResult>();

  // Initialize
  for (const steamId of allSteamIds) {
    result.set(steamId, { ctKills: 0, ctDeaths: 0, ctAdr: 0, ctRating: 0, tKills: 0, tDeaths: 0, tAdr: 0, tRating: 0 });
  }

  // Track per-side accumulators for rating
  const sideAccum = new Map<string, { ct: { kills: number; deaths: number; damage: number; rounds: number }; t: { kills: number; deaths: number; damage: number; rounds: number } }>();
  for (const steamId of allSteamIds) {
    sideAccum.set(steamId, {
      ct: { kills: 0, deaths: 0, damage: 0, rounds: 0 },
      t: { kills: 0, deaths: 0, damage: 0, rounds: 0 },
    });
  }

  // Determine player side per round
  function getPlayerSide(steamId: string, roundNumber: number): "CT" | "T" {
    const teamKey = steamToTeam.get(steamId);
    const totalRounds = rounds.length;
    const { tTeamKey } = getTeamSidesForRound(roundNumber, totalRounds, team1FirstHalfSide);
    return teamKey === tTeamKey ? "T" : "CT";
  }

  // Count rounds per side per player
  for (const round of rounds) {
    for (const steamId of allSteamIds) {
      const side = getPlayerSide(steamId, round.roundNumber);
      const acc = sideAccum.get(steamId)!;
      if (side === "CT") acc.ct.rounds++;
      else acc.t.rounds++;
    }
  }

  // Kills
  for (const k of kills) {
    if (!k.attackerSteamId || !k.victimSteamId) continue;
    const attackerSide = getPlayerSide(k.attackerSteamId, k.roundNumber);
    const victimSide = getPlayerSide(k.victimSteamId, k.roundNumber);
    const attackerEntry = result.get(k.attackerSteamId);
    const victimEntry = result.get(k.victimSteamId);
    const attackerAcc = sideAccum.get(k.attackerSteamId);
    const victimAcc = sideAccum.get(k.victimSteamId);
    if (attackerEntry && attackerAcc) {
      if (attackerSide === "CT") { attackerEntry.ctKills++; attackerAcc.ct.kills++; }
      else { attackerEntry.tKills++; attackerAcc.t.kills++; }
    }
    if (victimEntry && victimAcc) {
      if (victimSide === "CT") { victimEntry.ctDeaths++; victimAcc.ct.deaths++; }
      else { victimEntry.tDeaths++; victimAcc.t.deaths++; }
    }
  }

  // Damage
  for (const h of hurts) {
    if (!h.attackerSteamId) continue;
    const side = getPlayerSide(h.attackerSteamId, h.roundNumber);
    const acc = sideAccum.get(h.attackerSteamId);
    if (acc) {
      if (side === "CT") acc.ct.damage += h.damage;
      else acc.t.damage += h.damage;
    }
  }

  // Compute ADR and rating per side
  for (const [steamId, entry] of result) {
    const acc = sideAccum.get(steamId)!;
    entry.ctAdr = acc.ct.rounds > 0 ? Math.round((acc.ct.damage / acc.ct.rounds) * 10) / 10 : 0;
    entry.tAdr = acc.t.rounds > 0 ? Math.round((acc.t.damage / acc.t.rounds) * 10) / 10 : 0;
    entry.ctRating = computeRating({ kills: acc.ct.kills, deaths: acc.ct.deaths, totalDamage: acc.ct.damage, kastRounds: 0, roundsPlayed: acc.ct.rounds, entryKills: 0, clutchWins: 0 });
    entry.tRating = computeRating({ kills: acc.t.kills, deaths: acc.t.deaths, totalDamage: acc.t.damage, kastRounds: 0, roundsPlayed: acc.t.rounds, entryKills: 0, clutchWins: 0 });
  }

  return result;
}
```

Note: Side-split rating uses simplified inputs (no KAST/entry/clutch per side — those would require per-side tracking in the round loop which is too invasive). The K/D/ADR-based rating is still meaningful for side comparison.

- [ ] **Step 3: Wire into buildRichDemoAnalytics**

After economy:

```ts
  // Extended analytics: side-split
  const sideSplit = computeSideSplit(parsed.kills, parsed.hurts, parsed.rounds, steamToTeam, team1Side, allSteamIds);
```

In player analytics spread:

```ts
      ...(sideSplit.get(a.steamId) ?? {}),
```

- [ ] **Step 4: Commit**

```bash
git add src/server/demo-analytics-builder.ts
git commit -m "feat(builder): add side-split performance computation"
```

---

## Task 8: Store — Persist New Fields

**Files:**
- Modify: `src/server/demo-analytics-store.ts:195-256`

- [ ] **Step 1: Fix duplicate rating_demo key**

In `buildPlayerRow` (line 208), remove the first `rating_demo: null` — the one on line 226 (`rating_demo: player.rating ?? null`) is correct.

- [ ] **Step 2: Extend buildPlayerRow with new fields**

After `multi_kill_ace` (line 233), add:

```ts
    // Utility mastery
    smokes_thrown: player.smokesThrown ?? 0,
    flashes_thrown: player.flashesThrown ?? 0,
    hes_thrown: player.hesThrown ?? 0,
    molotovs_thrown: player.molotovsThrown ?? 0,
    utility_per_round: player.utilityPerRound ?? 0,
    avg_flash_blind_duration: player.avgFlashBlindDuration ?? 0,
    team_flashes: player.teamFlashes ?? 0,
    effective_flash_rate: player.effectiveFlashRate ?? 0,
    // Kill quality
    wallbang_kills: player.wallbangKills ?? 0,
    thrusmoke_kills: player.thrusmokeKills ?? 0,
    noscope_kills: player.noscopeKills ?? 0,
    avg_kill_distance: player.avgKillDistance ?? 0,
    weapon_kills: JSON.stringify(player.weaponKills ?? {}),
    // Economy
    total_spend: player.totalSpend ?? 0,
    economy_efficiency: player.economyEfficiency ?? 0,
    weapon_rounds: JSON.stringify(player.weaponRounds ?? {}),
    // Side-split
    ct_kills: player.ctKills ?? 0,
    ct_deaths: player.ctDeaths ?? 0,
    ct_adr: player.ctAdr ?? 0,
    ct_rating: player.ctRating ?? 0,
    t_kills: player.tKills ?? 0,
    t_deaths: player.tDeaths ?? 0,
    t_adr: player.tAdr ?? 0,
    t_rating: player.tRating ?? 0,
```

- [ ] **Step 3: Extend buildRoundRow with equip values**

After `defuser_steam_id` (line 254), add:

```ts
    t_equip_value: round.tEquipValue ?? 0,
    ct_equip_value: round.ctEquipValue ?? 0,
```

- [ ] **Step 4: Commit**

```bash
git add src/server/demo-analytics-store.ts
git commit -m "feat(store): persist extended demo analytics fields"
```

---

## Task 9: Read Path — Deserialize New Fields

**Files:**
- Modify: `src/server/matches.ts:451-493` (player mapping in fetchDemoAnalyticsForMatch)

- [ ] **Step 1: Extend player mapping**

After `killTimings` (line 491), add:

```ts
        // Utility mastery
        smokesThrown: Number(p.smokes_thrown ?? 0),
        flashesThrown: Number(p.flashes_thrown ?? 0),
        hesThrown: Number(p.hes_thrown ?? 0),
        molotovsThrown: Number(p.molotovs_thrown ?? 0),
        utilityPerRound: Number(p.utility_per_round ?? 0),
        avgFlashBlindDuration: Number(p.avg_flash_blind_duration ?? 0),
        teamFlashes: Number(p.team_flashes ?? 0),
        effectiveFlashRate: Number(p.effective_flash_rate ?? 0),
        // Kill quality
        wallbangKills: Number(p.wallbang_kills ?? 0),
        thrusmokeKills: Number(p.thrusmoke_kills ?? 0),
        noscopeKills: Number(p.noscope_kills ?? 0),
        avgKillDistance: Number(p.avg_kill_distance ?? 0),
        weaponKills: typeof p.weapon_kills === "object" && p.weapon_kills !== null ? (p.weapon_kills as Record<string, number>) : {},
        // Economy
        totalSpend: Number(p.total_spend ?? 0),
        economyEfficiency: Number(p.economy_efficiency ?? 0),
        weaponRounds: typeof p.weapon_rounds === "object" && p.weapon_rounds !== null ? (p.weapon_rounds as Record<string, number>) : {},
        // Side-split
        ctKills: Number(p.ct_kills ?? 0),
        ctDeaths: Number(p.ct_deaths ?? 0),
        ctAdr: Number(p.ct_adr ?? 0),
        ctRating: Number(p.ct_rating ?? 0),
        tKills: Number(p.t_kills ?? 0),
        tDeaths: Number(p.t_deaths ?? 0),
        tAdr: Number(p.t_adr ?? 0),
        tRating: Number(p.t_rating ?? 0),
```

- [ ] **Step 2: Extend round mapping**

Find the round mapping section (after player mapping). Add to the round map:

```ts
        tEquipValue: Number(r.t_equip_value ?? 0),
        ctEquipValue: Number(r.ct_equip_value ?? 0),
```

- [ ] **Step 3: Commit**

```bash
git add src/server/matches.ts
git commit -m "feat(match): deserialize extended demo analytics from DB"
```

---

## Task 10: Re-ingest Demos

- [ ] **Step 1: Delete existing demo analytics data**

Before re-ingesting, clear old data for the 3 matches so new columns get populated. Run via Supabase MCP `execute_sql`:

```sql
DELETE FROM demo_round_analytics WHERE faceit_match_id IN ('1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3', '1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24', '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b');
DELETE FROM demo_player_analytics WHERE faceit_match_id IN ('1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3', '1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24', '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b');
DELETE FROM demo_team_analytics WHERE faceit_match_id IN ('1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3', '1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24', '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b');
DELETE FROM demo_match_analytics WHERE faceit_match_id IN ('1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3', '1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24', '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b');
DELETE FROM demo_ingestions WHERE faceit_match_id IN ('1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3', '1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24', '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b');
```

- [ ] **Step 2: Re-ingest all 3 demos**

```bash
set -a && source .env.local && set +a
npx tsx scripts/ingest-demo.ts "1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3" "/Users/ventsislav.nikolov/Downloads/1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3-1-1.dem.zst"
npx tsx scripts/ingest-demo.ts "1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24" "/Users/ventsislav.nikolov/Downloads/1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24-1-1.dem.zst"
npx tsx scripts/ingest-demo.ts "1-56d10dbb-e90c-4b5a-95ea-b9572df1749b" "/Users/ventsislav.nikolov/Downloads/1-56d10dbb-e90c-4b5a-95ea-b9572df1749b-1-1.dem.zst"
```

- [ ] **Step 3: Verify new columns populated**

```sql
SELECT nickname, smokes_thrown, flashes_thrown, wallbang_kills, total_spend, ct_kills, t_kills
FROM demo_player_analytics
WHERE faceit_match_id = '1-56d10dbb-e90c-4b5a-95ea-b9572df1749b'
LIMIT 5;
```

Expected: non-zero values for smokes_thrown, total_spend, ct_kills, t_kills.

---

## Task 11: UI — PlayerAnalyticsDetail New Sections

**Files:**
- Modify: `src/components/PlayerAnalyticsDetail.tsx`

- [ ] **Step 1: Add "Utility thrown" section**

After the existing "Utility" section (after line 119), add:

```tsx
          {/* Utility thrown */}
          <SectionLabel label="Utility thrown" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Smokes" value={String(d.smokesThrown ?? 0)} />
            <StatBlock label="Flashes" value={String(d.flashesThrown ?? 0)} />
            <StatBlock label="HEs" value={String(d.hesThrown ?? 0)} />
            <StatBlock label="Molotovs" value={String(d.molotovsThrown ?? 0)} />
            <StatBlock label="Util/round" value={String(d.utilityPerRound ?? 0)} />
            <StatBlock label="Avg blind" value={`${(d.avgFlashBlindDuration ?? 0).toFixed(1)}s`} />
          </div>
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Team flashes" value={String(d.teamFlashes ?? 0)} negative={(d.teamFlashes ?? 0) > 5} />
            <StatBlock label="Eff. flash%" value={`${d.effectiveFlashRate ?? 0}%`} accent={(d.effectiveFlashRate ?? 0) >= 50} />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
          </div>
```

- [ ] **Step 2: Add "Kill quality" section**

```tsx
          {/* Kill quality */}
          <SectionLabel label="Kill quality" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Wallbangs" value={String(d.wallbangKills ?? 0)} accent={(d.wallbangKills ?? 0) > 0} />
            <StatBlock label="Thru smoke" value={String(d.thrusmokeKills ?? 0)} accent={(d.thrusmokeKills ?? 0) > 0} />
            <StatBlock label="No-scopes" value={String(d.noscopeKills ?? 0)} accent={(d.noscopeKills ?? 0) > 0} />
            <StatBlock label="Avg dist" value={(d.avgKillDistance ?? 0).toFixed(1)} />
            {(() => {
              const wk = d.weaponKills ?? {};
              const top = Object.entries(wk).sort(([,a],[,b]) => b - a).slice(0, 2);
              return top.map(([w, c]) => (
                <StatBlock key={w} label={w.replace(/_/g, " ")} value={String(c)} />
              ));
            })()}
          </div>
```

- [ ] **Step 3: Add "Side performance" section**

```tsx
          {/* Side performance */}
          <SectionLabel label="Side performance" />
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="border border-border rounded p-2">
              <div className="text-[9px] text-text-dim uppercase mb-1">CT side</div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div><div className="text-text-dim">K</div><div className="text-text font-medium">{d.ctKills ?? 0}</div></div>
                <div><div className="text-text-dim">D</div><div className="text-text font-medium">{d.ctDeaths ?? 0}</div></div>
                <div><div className="text-text-dim">ADR</div><div className="text-text font-medium">{(d.ctAdr ?? 0).toFixed(1)}</div></div>
                <div><div className="text-text-dim">RTG</div><div className="text-accent font-medium">{(d.ctRating ?? 0).toFixed(2)}</div></div>
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-[9px] text-text-dim uppercase mb-1">T side</div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div><div className="text-text-dim">K</div><div className="text-text font-medium">{d.tKills ?? 0}</div></div>
                <div><div className="text-text-dim">D</div><div className="text-text font-medium">{d.tDeaths ?? 0}</div></div>
                <div><div className="text-text-dim">ADR</div><div className="text-text font-medium">{(d.tAdr ?? 0).toFixed(1)}</div></div>
                <div><div className="text-text-dim">RTG</div><div className="text-accent font-medium">{(d.tRating ?? 0).toFixed(2)}</div></div>
              </div>
            </div>
          </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PlayerAnalyticsDetail.tsx
git commit -m "feat(ui): add utility, kill quality, side-split sections to player detail"
```

---

## Task 12: UI — AnalystDashboard Charts

**Files:**
- Modify: `src/components/AnalystDashboard.tsx`

- [ ] **Step 1: Add utility stacked bar chart to Overview tab**

In the Overview tab section, after existing charts, add a utility usage stacked bar:

```tsx
{/* Utility Usage by Player */}
<div className="border border-border rounded-lg p-3 mb-4">
  <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Utility thrown</div>
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={demoAnalytics.players.map(p => ({
      name: p.nickname.slice(0, 8),
      Smokes: p.smokesThrown ?? 0,
      Flashes: p.flashesThrown ?? 0,
      HEs: p.hesThrown ?? 0,
      Molotovs: p.molotovsThrown ?? 0,
    }))}>
      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--color-text-dim)" }} />
      <YAxis tick={{ fontSize: 9, fill: "var(--color-text-dim)" }} />
      <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 10 }} />
      <Bar dataKey="Smokes" stackId="util" fill="#6b7280" />
      <Bar dataKey="Flashes" stackId="util" fill="#facc15" />
      <Bar dataKey="HEs" stackId="util" fill="#ef4444" />
      <Bar dataKey="Molotovs" stackId="util" fill="#f97316" />
    </BarChart>
  </ResponsiveContainer>
</div>
```

- [ ] **Step 2: Add economy efficiency bar chart**

```tsx
{/* Economy Efficiency */}
<div className="border border-border rounded-lg p-3 mb-4">
  <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Economy efficiency (DMG per $1000)</div>
  <ResponsiveContainer width="100%" height={160}>
    <BarChart data={demoAnalytics.players.map(p => ({
      name: p.nickname.slice(0, 8),
      efficiency: p.economyEfficiency ?? 0,
    })).sort((a, b) => b.efficiency - a.efficiency)}>
      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--color-text-dim)" }} />
      <YAxis tick={{ fontSize: 9, fill: "var(--color-text-dim)" }} />
      <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 10 }} />
      <Bar dataKey="efficiency" fill="var(--color-accent)" />
    </BarChart>
  </ResponsiveContainer>
</div>
```

- [ ] **Step 3: Import any missing recharts components**

Ensure `Bar, BarChart` are imported from recharts (may already be imported).

- [ ] **Step 4: Add to Team Compare tab**

In the Team Compare section, the existing code uses a `metrics` array of `{ label, a, b, invert? }` objects. Add new entries to that array:

```ts
// Add to the existing metrics array in CompareTab:
{ label: "Utility thrown", a: team1Players.reduce((s, p) => s + (p.smokesThrown ?? 0) + (p.flashesThrown ?? 0) + (p.hesThrown ?? 0) + (p.molotovsThrown ?? 0), 0), b: team2Players.reduce((s, p) => s + (p.smokesThrown ?? 0) + (p.flashesThrown ?? 0) + (p.hesThrown ?? 0) + (p.molotovsThrown ?? 0), 0) },
{ label: "Team flashes", a: team1Players.reduce((s, p) => s + (p.teamFlashes ?? 0), 0), b: team2Players.reduce((s, p) => s + (p.teamFlashes ?? 0), 0), invert: true },
{ label: "Total spend", a: team1Players.reduce((s, p) => s + (p.totalSpend ?? 0), 0), b: team2Players.reduce((s, p) => s + (p.totalSpend ?? 0), 0) },
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalystDashboard.tsx
git commit -m "feat(ui): add utility and economy charts to analyst dashboard"
```

---

## Task 13: UI — TeamSummaryCards

**Files:**
- Modify: `src/components/TeamSummaryCards.tsx`

- [ ] **Step 1: Add utility thrown stats to TeamCard**

In the "Utility" section (after line 125), add new rows:

```tsx
        <StatRow label="Total thrown" value={
          players.reduce((s, p) => s + (p.smokesThrown ?? 0) + (p.flashesThrown ?? 0) + (p.hesThrown ?? 0) + (p.molotovsThrown ?? 0), 0)
        } />
        <StatRow label="Team flashes" value={
          players.reduce((s, p) => s + (p.teamFlashes ?? 0), 0)
        } negative />
        <StatRow label="Avg blind" value={
          (() => {
            const durations = players.map(p => p.avgFlashBlindDuration ?? 0).filter(d => d > 0);
            return durations.length > 0 ? `${(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1)}s` : "-";
          })()
        } />
```

Note: Expand the grid from `grid-cols-3` to `grid-cols-3` with an extra row, or change to `grid-cols-6` to accommodate. Verify layout after implementation.

- [ ] **Step 2: Commit**

```bash
git add src/components/TeamSummaryCards.tsx
git commit -m "feat(ui): add utility stats to team summary cards"
```

---

## Task 14: Verify End-to-End

- [ ] **Step 1: Run all tests**

```bash
pnpm vitest run
```

Expected: all tests pass. Fix any type errors from the new optional fields.

- [ ] **Step 2: Start dev server and verify visually**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/match/1-56d10dbb-e90c-4b5a-95ea-b9572df1749b`.

Verify:
- Player detail shows utility thrown, kill quality, side performance sections
- Overview tab shows utility stacked bar and economy efficiency charts
- Team compare shows utility thrown and total spend rows
- Team summary cards show utility stats

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve any remaining type/lint issues"
```

Only if there were fixes needed. Skip if clean.
