# Demo Analytics Match Page Design

## Overview

Add a full CS2 analyst-style match dashboard on the match page by combining FACEIT match data with optional demo-derived analytics.

Validated product decisions:

- The deep analytics surface lives on the match page first.
- Demo-derived cross-match summaries may appear later from `1+` parsed demos.
- Demo-derived metrics must always show a visible sample label, for example `Demo sample: 5`.
- Demo ingestion supports both FACEIT demo URLs and manual demo attachment.
- The primary visual target is the attached analyst dashboard in [cs2-dashboard.jsx](/Users/ventsislav.nikolov/Downloads/cs2-dashboard.jsx), adapted to the current app.
- Home, leaderboard, and history keep using FACEIT-native aggregate data until demo coverage is broad enough to support a separate demo-sample mode.

This is a hybrid architecture. FACEIT remains the baseline source for match identity and standard scoreboard stats. Demo parsing enriches a match with round-level and event-derived analytics only when a demo is available and parsed successfully.

## Product Boundary

The match page becomes the single trustworthy place for deep match analytics.

Two data layers must remain explicit:

1. `FACEIT baseline`
   - match ID
   - map
   - queue or competition
   - match status
   - roster
   - score
   - standard player stats already returned by FACEIT
2. `Demo analytics`
   - round-by-round progression
   - opening duel results
   - trades and untraded deaths
   - clutch attempts and wins
   - plants and defuses
   - last-alive counts
   - exit kills
   - side splits
   - custom impact metrics such as RWS

The UI must never silently present demo-derived numbers as if they were full-history or FACEIT-native aggregate values. If only one demo exists, the analytics are still valid, but their scope is that one match or that one parsed sample set.

## Architecture

### Baseline Match Flow

The current server path in [src/server/matches.ts](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/server/matches.ts) already fetches:

- `GET /matches/{matchId}`
- `GET /matches/{matchId}/stats`

and returns:

- `demoUrl`
- teams and scores
- parsed standard player stats

That path should remain the first render path for the match page.

### Demo Enrichment Flow

Add a second read path that looks up parsed demo analytics by `matchId`.

If analytics exist:

- merge them into the match-page response
- render the full analyst dashboard

If analytics do not exist:

- render the FACEIT baseline page
- show a dedicated `Demo analytics` panel with current availability and actions

If parsing is in progress:

- keep the baseline page visible
- show a non-blocking parsing state

If parsing failed:

- keep the baseline page visible
- show the last parse status and error summary

## Ingestion Model

Both ingestion paths converge to the same parser pipeline.

### Source A: FACEIT demo URL

Use the `demoUrl` already returned by the FACEIT match endpoint. If the URL is live, download and parse it.

### Source B: Manual demo attachment

Allow a user to attach a local `.dem` or `.dem.zst` file to a known `matchId`. This is a first-class path because some FACEIT demos are practically obtainable only manually.

### Shared ingestion rules

Every demo source creates or updates one ingestion row keyed by match and file fingerprint.

Track:

- `match_id`
- `source_type` (`faceit_url` or `manual_upload`)
- `source_url` when relevant
- `file_name`
- `file_size_bytes`
- `file_sha256`
- `compression` (`dem`, `zst`)
- `status`
- `parser_version`
- `demo_patch_version`
- `error_message`
- `started_at`
- `finished_at`

The parser job should deduplicate by `match_id` and fingerprint so the same file is not reparsed unnecessarily.

## Data Model

Store normalized rollups instead of a single analytics JSON blob.

### `demo_match_analytics`

One row per parsed match.

Suggested fields:

- `faceit_match_id`
- `map_name`
- `server_name`
- `demo_source_type`
- `total_rounds`
- `winner_team_key`
- `team1_name`
- `team2_name`
- `team1_score`
- `team2_score`
- `team1_first_half_side`
- `team2_first_half_side`
- `longest_team1_win_streak`
- `longest_team2_win_streak`
- `ingestion_status`
- `parsed_at`

### `demo_player_analytics`

Ten rows per parsed match.

Suggested fields:

- `faceit_match_id`
- `faceit_player_id` when resolvable
- `steam_id`
- `nickname`
- `team_key`
- `kills`
- `deaths`
- `assists`
- `adr_demo`
- `hs_percent_demo`
- `rating_demo` if formula is explicitly defined later
- `entry_kills`
- `entry_deaths`
- `opening_duel_attempts`
- `opening_duel_wins`
- `trade_kills`
- `traded_deaths`
- `untraded_deaths`
- `exit_kills`
- `clutch_attempts`
- `clutch_wins`
- `last_alive_rounds`
- `bomb_plants`
- `bomb_defuses`
- `utility_damage_demo`
- `flash_assists_demo`
- `rws`
- `sample_match_count` for future aggregate reuse

### `demo_team_analytics`

Two rows per parsed match.

Suggested fields:

- `faceit_match_id`
- `team_key`
- `name`
- `first_half_side`
- `trade_rate`
- `opening_duel_win_rate`
- `rounds_won`
- `rounds_lost`
- `longest_win_streak`
- `longest_loss_streak`

### `demo_round_analytics`

One row per round.

Suggested fields:

- `faceit_match_id`
- `round_number`
- `winner_team_key`
- `score_team1`
- `score_team2`
- `t_team_key`
- `ct_team_key`
- `t_buy_type`
- `ct_buy_type`
- `is_pistol`
- `end_reason`
- `bomb_planted`
- `bomb_defused`
- `planter_steam_id`
- `defuser_steam_id`

Persisting raw events is optional and out of scope for v1.

## Metric Ownership

### FACEIT-owned metrics

Use FACEIT as the visible baseline for:

- K
- D
- A
- ADR
- HS%
- K/R
- utility damage
- enemies flashed
- clutch counts already returned by FACEIT
- entry counts already returned by FACEIT
- pistol kills
- sniper kills

### Demo-owned metrics

Use demo parsing for:

- round timeline
- side-by-side half flow
- opening duel outcomes
- trade kills
- traded vs untraded deaths
- last alive
- exit kills
- clutch attempts and wins computed from event chronology
- plants and defuses
- side splits
- team streaks
- round-by-round buy buckets
- RWS

### Dual-source metrics

Where both sources can produce a metric, FACEIT remains the primary displayed baseline unless the product intentionally switches to the parsed value for a single-match dashboard. This avoids trust issues caused by small formula differences.

## Match Page UX

The route in [src/routes/_authed/match.$matchId.tsx](/Users/ventsislav.nikolov/Projects/ventsislavnikolov/faceit-stats-slap/src/routes/_authed/match.$matchId.tsx) should become a dedicated post-match analytics page, not a live-match shell.

### Render phases

1. Load FACEIT baseline immediately
2. Check parsed analytics status
3. Upgrade into analyst dashboard if analytics are available

### Primary layout

Match header:

- map
- queue or competition
- final score
- half score context when available
- demo analytics status badge

Dashboard sections:

- analyst-style scoreboard
- round timeline strip
- team summary cards
- player detail card for the selected player
- impact cards
- utility cards
- clutch and survival cards
- economy strip or chart if buy classification proves reliable

### Demo analytics panel states

- `Available from FACEIT`
- `Attach manual demo`
- `Queued`
- `Parsing`
- `Parsed`
- `Failed`
- `Source unavailable`

The panel should also show:

- source type
- parse timestamp
- parser version
- sample scope

## Parser Scope For V1

Ship only metrics that can be defended from the event stream and explained simply.

V1 includes:

- round winners and score progression
- opening duel outcomes
- trade kills
- traded and untraded deaths
- clutch attempts and wins
- bomb plants and defuses
- last-alive counts
- exit kills
- utility damage cross-checks
- side splits
- streaks
- RWS

V1.5 or later:

- weapon accuracy panels
- richer spatial heatmap or position views
- persistent raw event storage

Economy labels may ship in v1 only if round-start equipment and money fields prove stable across the initial demo sample set.

## Reliability And Failure Handling

Parsing must never block the base match page.

Statuses:

- `queued`
- `parsing`
- `parsed`
- `failed`
- `source_unavailable`

On failure:

- keep the FACEIT baseline page available
- show a compact parse error state
- allow retry from a different source

Store enough metadata to support reprocessing later:

- parser version
- demo patch version
- file fingerprint
- source type

## Implementation Order

1. Add normalized ingestion and analytics tables plus parser status model.
2. Build a parser service around the known local demo and prove analytics output against the provided match.
3. Upgrade the match page to read FACEIT baseline plus parsed analytics.
4. Add ingestion actions for FACEIT fetch and manual attachment.
5. Add future player-level demo-sample summaries reusing the same analytics tables.

## Testing

### Parser tests

- decompress `.dem.zst`
- parse demo header
- parse the event types required for v1
- validate the known provided match produces:
  - map `de_inferno`
  - 10 players
  - 20 rounds
  - correct winner and score

### Metric tests

- opening duel attribution
- trade window logic
- untraded death classification
- RWS sum per round
- plants and defuses attribution
- last-alive counts

### Route and UI tests

- baseline FACEIT-only render
- parsed analytics render
- queued or parsing state
- failed parse state
- source labeling

## Notes From Validation

Validated during research:

- the project already includes `@laihoe/demoparser2` and `fzstd`
- the supplied match returns one `demoUrl` from FACEIT
- the supplied local `.dem.zst` parses successfully with `demoparser2`
- the event stream includes `player_death`, `player_hurt`, `round_end`, `bomb_planted`, `bomb_defused`, `player_blind`, and `weapon_fire`
- richer analyst metrics in the attached dashboard are not available from the FACEIT stats endpoint alone
