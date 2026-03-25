# Extended Demo Analytics — Design Spec

## Goal

Add 4 new stat categories to the CS2 demo analytics system: Economy Intelligence, Utility Mastery, Kill Quality, and Side-Split Performance. All derived from event data already available in demoparser2 but not yet extracted.

## Context

Current system tracks 44+ metrics from `player_death`, `player_hurt`, `round_end`, `bomb_planted/defused`, `weapon_fire`, `player_blind`, `round_freeze_end`. Probing 3 real demos confirmed rich untapped data in `item_purchase`, grenade detonation events, `player_blind.blind_duration`, and unused `player_death` fields (`noscope`, `distance`, `penetrated`, `thrusmoke` — all confirmed present in demoparser2 output).

### Verified data availability

- `item_purchase`: has `cost` field (int, e.g. 650 for kevlar), `item_name`, `steamid`, `tick`
- `player_death`: has `noscope` (bool), `distance` (float), `penetrated` (bool), `thrusmoke` (bool)
- `player_blind`: has `blind_duration` (float, seconds) — already parsed as `duration` on `ParsedDemoBlind`
- `smokegrenade_detonate`, `flashbang_detonate`, `hegrenade_detonate`, `inferno_startburn`: all have `user_steamid`, `user_name`, `tick`, `x/y/z`

---

## 1. DB Schema Changes

Migration `008_extended_demo_analytics.sql` adding columns to `demo_player_analytics` and `demo_round_analytics`. All new columns use `DEFAULT 0` or `DEFAULT '{}'::jsonb` so existing rows remain valid.

### `demo_player_analytics` — new columns

**Utility Mastery:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `smokes_thrown` | int | 0 | Smoke grenades detonated |
| `flashes_thrown` | int | 0 | Flashbangs detonated |
| `hes_thrown` | int | 0 | HE grenades detonated |
| `molotovs_thrown` | int | 0 | Molotovs/incendiaries detonated |
| `utility_per_round` | numeric | 0 | Total utility thrown / rounds played |
| `avg_flash_blind_duration` | numeric | 0 | Avg blind duration in seconds per blind event caused |
| `team_flashes` | int | 0 | Flashes that blinded a teammate |
| `effective_flash_rate` | numeric | 0 | % of flashes that blinded at least one enemy |

**Kill Quality:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `wallbang_kills` | int | 0 | Kills through walls (penetrated=true) |
| `thrusmoke_kills` | int | 0 | Kills through smoke |
| `noscope_kills` | int | 0 | No-scope sniper kills |
| `avg_kill_distance` | numeric | 0 | Average engagement distance |
| `weapon_kills` | jsonb | '{}' | Kill count per weapon `{"ak47": 12, "awp": 5}` |

**Economy:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `total_spend` | int | 0 | Total $ spent across all rounds |
| `economy_efficiency` | numeric | 0 | Damage dealt per $1000 spent |
| `weapon_rounds` | jsonb | '{}' | Rounds by primary weapon category `{"rifle":14,"awp":3,"smg":2,"pistol":5}` |

**Side-Split:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `ct_kills` | int | 0 | Kills on CT side |
| `ct_deaths` | int | 0 | Deaths on CT side |
| `ct_adr` | numeric | 0 | ADR on CT side |
| `ct_rating` | numeric | 0 | Rating on CT side |
| `t_kills` | int | 0 | Kills on T side |
| `t_deaths` | int | 0 | Deaths on T side |
| `t_adr` | numeric | 0 | ADR on T side |
| `t_rating` | numeric | 0 | Rating on T side |

### `demo_round_analytics` — new columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `t_equip_value` | int | 0 | T-side total equipment spend from item_purchase |
| `ct_equip_value` | int | 0 | CT-side total equipment spend from item_purchase |

---

## 2. Type Extensions

### `ParsedDemoFile` — new fields

```ts
itemPurchases: ParsedDemoItemPurchase[];
grenadeDetonates: ParsedDemoGrenadeDetonate[];
```

### New parser types

```ts
interface ParsedDemoItemPurchase {
  tick: number;
  roundNumber: number;  // resolved from tick vs round boundaries
  steamId: string;
  nickname: string;
  itemName: string;
  cost: number;
}

interface ParsedDemoGrenadeDetonate {
  tick: number;
  roundNumber: number;  // resolved from tick vs round boundaries
  steamId: string;
  nickname: string;
  type: "smoke" | "flash" | "he" | "molotov";
  x: number;
  y: number;
  z: number;
}
```

### `ParsedDemoBlind` — no change needed

The existing `duration: number` field (parsed from `blind_duration`) already captures flash blind duration. Builder will reference `blind.duration`.

### `ParsedDemoKill` — extend

Add fields not currently extracted:
```ts
noscope: boolean;
distance: number;
```

These are already present in demoparser2's `player_death` output but not yet captured by `normalizeKills`.

### `DemoPlayerAnalytics` — extend

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

// Kill quality
wallbangKills?: number;
thrusmokeKills?: number;
noscopeKills?: number;
avgKillDistance?: number;
weaponKills?: Record<string, number>;

// Economy
totalSpend?: number;
economyEfficiency?: number;
weaponRounds?: Record<string, number>;

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

### `DemoRoundAnalytics` — extend

```ts
tEquipValue?: number;
ctEquipValue?: number;
```

---

## 3. Parser Changes (`demo-parser.ts`)

### New event parsing in `parseDemoFile`

Add parsing for 4 new event types:

- `item_purchase` → `normalizeItemPurchases()` → `ParsedDemoItemPurchase[]`
- `smokegrenade_detonate` + `flashbang_detonate` + `hegrenade_detonate` + `inferno_startburn` → `normalizeGrenadeDetonates()` → `ParsedDemoGrenadeDetonate[]`

All grenade detonates merged into single `grenadeDetonates` array with type discriminator.

### Extend `normalizeKills`

Add extraction of `noscope` (boolean) and `distance` (number) from `player_death` events. Both fields confirmed present in demoparser2 output.

### Round number resolution

Both `ParsedDemoItemPurchase` and `ParsedDemoGrenadeDetonate` need `roundNumber`. Resolve by comparing `tick` against `roundBounds` (from `round_freeze_end` ticks), same pattern used for existing kill/hurt normalization.

---

## 4. Builder Changes (`demo-analytics-builder.ts`)

4 new pure compute functions called inside `buildRichDemoAnalytics` after existing computations. Each returns `Map<steamId, Partial<DemoPlayerAnalytics>>` that gets merged into player records.

### `computeUtilityMastery(grenadeDetonates, blinds, playerTeamMap, totalRounds)`
- Count smokes/flashes/HEs/molotovs per player (by steamId from grenadeDetonates)
- `utilityPerRound` = total grenades thrown by player / totalRounds
- `avgFlashBlindDuration` = sum(`blind.duration` where `blind.attackerSteamId === steamId`) / count of those blinds
- `teamFlashes` = blind events where attacker and victim share same teamKey (lookup via `playerTeamMap`)
- `effectiveFlashRate` = (flashbang detonates by this player that have at least one matching enemy blind event with same attacker steamId) / total flashbang detonates by this player. Join: match `grenadeDetonate(type=flash, steamId=X)` to `blind(attackerSteamId=X)` by tick proximity (blind tick within 64 ticks of detonate tick).

### `computeKillQuality(kills)`
- Per attacker steamId: count `penetrated=true` → `wallbangKills`, `thruSmoke=true` → `thrusmokeKills`, `noscope=true` → `noscopeKills`
- `avgKillDistance` = mean of `distance` field for all kills by player (exclude distance=0)
- `weaponKills` = `Record<weapon, count>` per player from kill `weapon` field

### `computeEconomy(itemPurchases, totalDamageByPlayer, roundBounds, playerTeamMap, sideMap)`
- `totalSpend` = sum of `cost` for all purchases by player (cost comes directly from `item_purchase` event)
- `economyEfficiency` = (totalDamage / totalSpend) * 1000. Guard: if totalSpend=0, efficiency=0
- `weaponRounds`: per round, find most expensive weapon purchased by player. Classify: awp (item contains "awp"), rifle (ak47/m4a1/m4a1_silencer/famas/galilar/aug/sg556), smg (mac10/mp9/mp7/mp5sd/ump45/p90/bizon), pistol (everything else). Count rounds per category.
- Per-round `tEquipValue` / `ctEquipValue`: sum purchases by team using `playerTeamMap` + `sideMap` for that round, all purchases between round's freeze_end tick and next round's freeze_end tick.

### `computeSideSplit(kills, hurts, roundBounds, playerTeamMap, sideMap, totalRounds)`
- Partition kills/deaths/damage into first-half (rounds 1-12) and second-half (rounds 13+)
- Use existing `sideMap` (from `detectFirstHalfSides`) to determine each player's CT/T per half:
  - If team1 starts CT → team1 is CT in first half, T in second half
  - After swap at round 13, sides flip
  - MR12 overtime: sides swap every 3 rounds (handled if present)
- Per-side accumulate: kills, deaths, damage → compute ADR = damage / rounds_on_that_side
- Per-side rating: extract existing `computeRating` to accept per-side inputs (kills, deaths, damage, rounds, assists, etc.). Currently `computeRating` takes full-match stats — refactor to accept a stats slice so it can be called for CT-only and T-only subsets.

---

## 5. Store Changes (`demo-analytics-store.ts`)

### `buildPlayerRow` — extend

Add all new fields with snake_case mapping:
- `smokes_thrown`, `flashes_thrown`, `hes_thrown`, `molotovs_thrown`, `utility_per_round`, `avg_flash_blind_duration`, `team_flashes`, `effective_flash_rate`
- `wallbang_kills`, `thrusmoke_kills`, `noscope_kills`, `avg_kill_distance`, `weapon_kills: JSON.stringify(p.weaponKills ?? {})`
- `total_spend`, `economy_efficiency`, `weapon_rounds: JSON.stringify(p.weaponRounds ?? {})`
- `ct_kills`, `ct_deaths`, `ct_adr`, `ct_rating`, `t_kills`, `t_deaths`, `t_adr`, `t_rating`

Also fix pre-existing duplicate `rating_demo` key in `buildPlayerRow` (lines 208 and 226 — second overwrites first).

### `buildRoundRow` — extend

Add `t_equip_value`, `ct_equip_value`.

---

## 6. Read-Path Changes (`matches.ts`)

### `fetchDemoAnalyticsForMatch` — extend player mapping

The function already does `select("*")` so new columns are fetched automatically. Extend the player mapping object to include:

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
weaponKills: typeof p.weapon_kills === "object" ? p.weapon_kills : {},
weaponRounds: typeof p.weapon_rounds === "object" ? p.weapon_rounds : {},

// Economy
totalSpend: Number(p.total_spend ?? 0),
economyEfficiency: Number(p.economy_efficiency ?? 0),

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

### Round mapping — extend

Add `tEquipValue` and `ctEquipValue` to the round mapping.

---

## 7. UI Changes

### `PlayerAnalyticsDetail.tsx` — 3 new sections

**"Utility usage"** section (grid-cols-6), after existing Utility section:
- Smokes thrown, Flashes thrown, HEs thrown, Molotovs thrown, Util/round, Avg flash duration
- (Second row) Team flashes, Effective flash rate %

**"Kill quality"** section (grid-cols-6):
- Wallbangs, Thru-smoke, No-scopes, Avg distance
- Top 2 weapons with kill counts (e.g. "AK-47: 12, AWP: 5")

**"Side performance"** section (2-column layout):
- CT side: K / D / ADR / Rating
- T side: K / D / ADR / Rating

### `AnalystDashboard.tsx` — enhancements

**Overview tab additions:**
- Utility usage stacked bar chart (recharts BarChart, per player, stacked by smoke/flash/HE/molotov colors)
- Economy efficiency bar chart (damage per $1000 by player)

**Team Compare tab additions:**
- New rows: total utility thrown, team flash rate, avg flash blind duration
- Side-split: CT rounds won vs T rounds won per team

### `TeamSummaryCards.tsx` — supplement existing Utility section

Add below existing "Utility" stats (Util DMG, Flash assists, Flashed):
- Total utility thrown (sum of all grenade types)
- Team flash count
- Avg flash blind duration

---

## 8. Migration & Re-ingestion

- New Supabase migration `008_extended_demo_analytics.sql` (next sequential after 007)
- All new columns have `DEFAULT 0` or `DEFAULT '{}'::jsonb` — existing rows unaffected
- Re-run `scripts/ingest-demo.ts` on all 3 existing demos to backfill new stats

---

## 9. Testing

### Builder integration test (`demo-analytics-builder.test.ts`)
- Extend existing real-demo integration test to assert new metric categories
- Verify utility counts match expected values from demo probe (e.g. 125 smokes, 106 flashes, 111 HEs, 95 molotovs for de_inferno demo)

### Unit tests for new compute functions
- `computeUtilityMastery`: test with mock grenades/blinds, verify per-player counts, flash duration averaging, team flash detection, effective flash rate
- `computeKillQuality`: test wallbang/thrusmoke/noscope counting, distance averaging (handle 0-distance), weapon kill map
- `computeEconomy`: test spend summing, efficiency calculation, division-by-zero guard (0 spend), weapon round classification
- `computeSideSplit`: test with 12-round first half + 12-round second half, verify side swap, verify ADR/rating per side

### Edge cases
- Overtime games (>24 rounds) — side swaps every 3 rounds after regulation
- 0 utility thrown — utilityPerRound=0, effectiveFlashRate=0
- 0 kills — avgKillDistance=0, empty weaponKills
- Player with 0 spend — economyEfficiency=0

### Component tests
- Update `PlayerAnalyticsDetail` tests for new sections
- Update `AnalystDashboard` tests for new charts
