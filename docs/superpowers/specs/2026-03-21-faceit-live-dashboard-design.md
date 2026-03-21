# FACEIT Live Dashboard — Design Spec

## Overview

Web app that monitors FACEIT CS2 matches of tracked friends in real-time, showing live match scores, player stats, match history, and Twitch stream embeds when friends are streaming.

**Users**: Small friend group (5-15 people), gated by Supabase email/password auth.

**Tech stack**: TanStack Start, TanStack Router, TanStack Query, Supabase (auth + PostgreSQL), Tailwind CSS v4.

**Deployment**: Vercel (free tier).

---

## Architecture

```
Browser (TanStack Start SPA)
│
│  TanStack Query hooks (polling)
│    → /api/friends         (5 min interval)
│    → /api/matches/live    (5 min, 30s when match active)
│    → /api/stats/:id       (on demand, cached 5 min)
│    → /api/twitch/live     (2 min interval)
│
│  Supabase Client (auth only in MVP)
│    → sign up / sign in / session management
│
└──► TanStack Start API Routes
      │
      ├──► FACEIT Open API (open.faceit.com/data/v4/)
      │      Auth: Bearer {FACEIT_API_KEY}
      │
      ├──► Twitch Helix API (api.twitch.tv/helix/)
      │      Auth: Client Credentials (TWITCH_CLIENT_ID + SECRET)
      │
      └──► Supabase PostgreSQL
             Write match data as side effect of every API call
```

All external API calls go through server-side routes — tokens never reach the browser. Every API route writes to Supabase as a side effect, building up history over time.

---

## FACEIT Open API Endpoints

All calls to `https://open.faceit.com/data/v4/` with `Authorization: Bearer {FACEIT_API_KEY}`.

| Route | FACEIT Endpoint | Purpose |
|-------|----------------|---------|
| `/api/friends` | `GET /players/{friendId}` + `GET /players/{friendId}/stats/cs2` for each friend in hardcoded `TRACKED_FRIENDS` array | Friend list with profiles and lifetime stats. Uses hardcoded list, not FACEIT friends_ids (simpler, predictable). |
| `/api/matches/live` | `GET /players/{friendId}/history?game=cs2&limit=1` for each friend, then `GET /matches/{matchId}` to check status | Detect ONGOING matches |
| `/api/matches/:matchId` | `GET /matches/{matchId}` + `GET /matches/{matchId}/stats` | Full match details with per-player stats |
| `/api/stats/:playerId` | `GET /players/{id}/history?game=cs2&offset=0&limit=30` + `GET /matches/{matchId}/stats` for each | Decoded match history |
| `/api/twitch/live` | Twitch Helix `GET /streams?user_login=bachiyski&user_login=kasheto88&user_login=soavarice` | Which streams are live |

### Response Format (Open API)

The Open API returns human-readable keys — no `i*/c*` decoding needed:

- **Lifetime stats**: `"Average K/D Ratio"`, `"Average Headshots %"`, `"ADR"`, `"Win Rate %"`, `"Recent Results"` (array of "1"/"0")
- **Match stats**: `"Kills"`, `"Deaths"`, `"Assists"`, `"K/D Ratio"`, `"ADR"`, `"Headshots %"`, `"MVPs"`, `"Triple Kills"`, `"Quadro Kills"`, `"Penta Kills"`
- **Match details**: `status` ("FINISHED" / "ONGOING"), `started_at`, `finished_at`, `results.score`

### Rate Limit Strategy

FACEIT Open API free tier has rate limits. Mitigation:

- Cache friend profiles and lifetime stats in Supabase (refresh every 30 min)
- Only poll match history frequently (every 5 min per friend)
- When a live match is detected, cache the match ID and poll match details at 30s intervals (single call, not per-friend)
- Stagger friend checks across polling intervals to avoid burst requests

---

## Data Model (Supabase PostgreSQL)

```sql
-- App users (links to Supabase Auth)
profiles (
  id              UUID PRIMARY KEY  -- = auth.users.id
  nickname        TEXT NOT NULL
  avatar_url      TEXT
  created_at      TIMESTAMPTZ
)

-- FACEIT friends being tracked
tracked_friends (
  id              UUID PRIMARY KEY
  faceit_id       TEXT UNIQUE NOT NULL
  nickname        TEXT NOT NULL
  avatar_url      TEXT
  elo             INTEGER
  skill_level     INTEGER
  win_rate        NUMERIC(5,2)
  lifetime_kd     NUMERIC(4,2)
  lifetime_hs     INTEGER
  lifetime_adr    NUMERIC(5,1)
  total_matches   INTEGER
  twitch_channel  TEXT              -- nullable: "bachiyski", "kasheto88", "soavarice"
  is_active       BOOLEAN DEFAULT true
  last_seen_at    TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
)

-- Matches (live and historical)
matches (
  id                UUID PRIMARY KEY
  faceit_match_id   TEXT UNIQUE NOT NULL
  status            TEXT NOT NULL DEFAULT 'ONGOING'  -- ONGOING | FINISHED | CANCELLED
  map               TEXT
  score             TEXT                             -- "13 / 11"
  started_at        TIMESTAMPTZ
  finished_at       TIMESTAMPTZ
  team_roster       JSONB                            -- [{faceitId, nickname, elo}]
  opponent_roster   JSONB
  match_data        JSONB                            -- raw FACEIT response
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
)

-- Per-player stats for each match
match_player_stats (
  id                UUID PRIMARY KEY
  match_id          UUID → matches(id)
  faceit_player_id  TEXT NOT NULL
  nickname          TEXT
  kills             INTEGER
  deaths            INTEGER
  assists           INTEGER
  headshots         INTEGER
  mvps              INTEGER
  kd_ratio          NUMERIC(4,2)
  adr               NUMERIC(5,1)
  hs_percent        INTEGER
  clutches          INTEGER
  triple_kills      INTEGER
  quadro_kills      INTEGER
  penta_kills       INTEGER
  elo_before        INTEGER   -- snapshot from player profile before match (best-effort)
  elo_after         INTEGER   -- snapshot from player profile after match (best-effort)
  elo_delta         INTEGER   -- computed: elo_after - elo_before (nullable if not captured)
  win               BOOLEAN
  map               TEXT
  played_at         TIMESTAMPTZ
  UNIQUE(match_id, faceit_player_id)
)
```

---

## UI Layout — Two Panel Dashboard

### Left Sidebar (260px)
- Shows **all tracked friends**, grouped: Playing first (green border, pulsing dot), then Offline (dimmed)
- When no one is playing: all friends shown as offline — sidebar is never empty
- Each friend card:
  - Avatar + nickname + ELO + skill level
  - 2x2 stat grid: K/D, HS%, ADR, Win Rate
  - Last-5 results streak bar (green/red segments)
  - Twitch LIVE badge (if streaming)
- Click a friend → loads their match history in main panel

### Main Area (flex)
- **Twitch stream embed** (top, full-width) — only when a friend is live
  - Header bar: Twitch icon, streamer name, LIVE badge, viewer count
  - Embedded Twitch player (`<iframe>`)
  - Controls: "Open on Twitch" link, fullscreen toggle
  - Hidden entirely when no one is streaming
- **Live match card** — score, map (color-coded), half scores, round count, list of friends in the match
- **Recent matches feed** — mixed from all playing friends
  - Each row: W/L indicator, player name, map (color-coded), score, K/D + ADR + HS%, ELO delta

### Design Tokens
- Background: `#050505`
- Accent: `#00ff88`
- Error/Loss: `#ff4444`
- Twitch purple: `#9146FF`
- Monospace font: JetBrains Mono (stats, numbers)
- Map colors: inferno=`#c94`, dust2=`#ca8`, nuke=`#4ac`, ancient=`#5a7`, mirage=`#a7c`, anubis=`#7a5`, vertigo=`#5ac`, fallback=`#888`
- Live indicators: pulsing red dot for live matches, green glow for playing friends

---

## App Routes

```
/              → Login page (Supabase email/password auth)
/dashboard     → Main two-panel dashboard
/history       → Past matches for all friends (filterable by friend)
/leaderboard   → Stub for Phase 2 (betting leaderboard)
```

---

## Environment Variables

```
FACEIT_API_KEY          # FACEIT Open API server-side key
TWITCH_CLIENT_ID        # Twitch app client ID
TWITCH_CLIENT_SECRET    # Twitch app client secret
SUPABASE_URL            # Supabase project URL
SUPABASE_ANON_KEY       # Supabase public anon key (client-side)
SUPABASE_SERVICE_KEY    # Supabase service role key (server-side)
```

---

## Twitch Integration

- Twitch Helix API: `GET /streams?user_login=bachiyski&user_login=kasheto88&user_login=soavarice`
- Single call checks all 3 channels at once
- Auth: Client Credentials flow (Client ID + Secret → app access token)
- Token auto-refreshes: request new app access token on every cold start (Client Credentials flow is cheap, avoids needing persistent storage for the token)
- When live: show embedded Twitch player at top of main panel via `<iframe>`
- When not live: section hidden

### Twitch Channel Mapping

FACEIT nicknames and Twitch usernames differ — hardcode the mapping:

| FACEIT Nickname | FACEIT ID | Twitch Channel |
|----------------|-----------|---------------|
| TibaBG | ad8034c1-6324-4080-b28e-dbf04239670a | twitch.tv/bachiyski |
| F1aw1esss | 65c93ab1-d2b2-416c-a5d1-d45452c9517d | twitch.tv/kasheto88 |
| soavarice | 15844c99-d26e-419e-bd14-30908f502c03 | twitch.tv/soavarice |

---

## Tracked Friends

```typescript
const TRACKED_FRIENDS = [
  "ad8034c1-6324-4080-b28e-dbf04239670a",
  "6de05371-90a0-4972-a96a-1bcc3381cfc6",
  "bbd4a555-939b-437b-a190-1de7791ff226",
  "28eef11b-a1d5-49f2-8130-627061f36cc1",
  "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
  "e42f5e99-4920-4b54-844b-b63cb3274005",
  "f5f5d541-11c4-420d-bcaa-c84bec02f96e",
  "fdcdb5a0-cd0a-41de-81fd-0400b1240f4f",
  "d1e26999-1a9d-492e-ba78-84e083aa0dd0",
  "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
  "57a110e4-fca7-4579-905e-d1cafe9dd3f5",
  "efc75558-1aea-4725-b1a6-13e78ec2e5f7",
  "c061d134-4643-4e55-8f07-32f845f47f0a",
  "65dd9a3c-15bc-425e-977a-cfc65e1e8375",
  "3a1c4a9b-5451-4ae6-a6f9-8fd448e47139",
  "40102345-6749-486e-9a6b-20824550175a",
  "208e0951-30cb-4804-b41d-424a843042e9",
  "e4603534-add6-47c9-bb71-a723758f215e",
  "63f331ae-ed7f-4a60-8227-3955ebcba342",
];
const MY_FACEIT_ID = "15844c99-d26e-419e-bd14-30908f502c03";
const MY_NICKNAME = "soavarice";
```

---

## Phase 2 — Betting System (Future)

Full spec preserved from FACEIT-DASHBOARD-SPEC.md Parts 3-4.

### Summary
- Virtual currency "coins" — everyone starts with 1000
- Betting pool opens when match detected as ONGOING
- Pool closes after round 3 (or 3 min after match start)
- Min bet: 10, Max bet: 500 per match
- One bet per user per match
- If only one side has bets, all bets refunded
- Pari-mutuel payout: winners split losers' pool proportionally

### Additional Tables Needed
- `betting_pools` — links to match, tracks WIN/LOSE pools, odds, status
- `bets` — individual bets with side, amount, payout
- `transactions` — audit log of all coin movements

### Additional Features
- Supabase Realtime subscriptions for live odds updates
- Leaderboard page (currently stub)
- `place_bet` and `resolve_pool` RPC functions (SQL in original spec)

---

## Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | TanStack Start | Learning goal — user wants to learn it |
| API | FACEIT Open API | Internal API blocked by Cloudflare; Open API works from server |
| Auth | Supabase email/password | Simple, built-in, good enough for small group |
| Polling | Client-side TanStack Query | Free tier friendly, no Vercel cron needed |
| Twitch | Helix API + iframe embed | Only show when live, single API call for all 3 channels |
| Betting | Deferred to Phase 2 | Ship dashboard first, validate API reliability |
| Storage | Supabase PostgreSQL | Store everything for history and Phase 2 readiness |
| Offline friends | Shown dimmed below playing friends | Sidebar is never empty — all friends visible, playing ones highlighted |
| Friends source | Hardcoded TRACKED_FRIENDS array | Simpler than querying FACEIT friends_ids, predictable, no divergence risk |
| Token management | Env var, manual refresh | Simple for MVP, FACEIT Open API key doesn't expire |
