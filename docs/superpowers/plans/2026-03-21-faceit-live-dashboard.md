# FACEIT Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time FACEIT CS2 friends dashboard with live match tracking, player stats, and Twitch stream embeds.

**Architecture:** TanStack Start SPA with server-side API routes proxying FACEIT Open API and Twitch Helix API. Supabase for auth (email/password) and PostgreSQL for storing match data. Client-side polling via TanStack Query.

**Tech Stack:** TanStack Start (RC), TanStack Router, TanStack Query, Supabase, Tailwind CSS v4, Vite, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-faceit-live-dashboard-design.md`

---

## File Structure

```
faceit-match/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout: dark theme, font loading
│   │   ├── index.tsx               # Login page (/)
│   │   ├── _authed.tsx             # Layout route: auth guard wrapper
│   │   ├── _authed/
│   │   │   ├── dashboard.tsx       # Main dashboard (/dashboard)
│   │   │   ├── history.tsx         # Match history (/history)
│   │   │   └── leaderboard.tsx     # Stub for Phase 2 (/leaderboard)
│   │   └── api/
│   │       ├── friends.ts          # GET /api/friends
│   │       ├── matches.live.ts     # GET /api/matches/live
│   │       ├── matches.$matchId.ts # GET /api/matches/:matchId
│   │       ├── stats.$playerId.ts  # GET /api/stats/:playerId
│   │       └── twitch.live.ts      # GET /api/twitch/live
│   ├── components/
│   │   ├── LoginForm.tsx           # Email/password auth form
│   │   ├── FriendsSidebar.tsx      # Left panel: friend list
│   │   ├── FriendCard.tsx          # Individual friend card with stats
│   │   ├── StreakBar.tsx           # Last-5 W/L colored segments
│   │   ├── LiveMatchCard.tsx       # Score display for live match
│   │   ├── RecentMatches.tsx       # Match history feed
│   │   ├── MatchRow.tsx            # Single match row in feed
│   │   ├── TwitchEmbed.tsx         # Twitch iframe player
│   │   └── MapBadge.tsx            # Map name with color coding
│   ├── hooks/
│   │   ├── useFriends.ts           # TanStack Query: friend list + stats
│   │   ├── useLiveMatches.ts       # TanStack Query: live match polling
│   │   ├── usePlayerStats.ts       # TanStack Query: player match history
│   │   └── useTwitchLive.ts        # TanStack Query: Twitch stream status
│   ├── lib/
│   │   ├── faceit.ts               # FACEIT Open API client
│   │   ├── twitch.ts               # Twitch Helix API client
│   │   ├── supabase.server.ts      # Supabase server client (service key)
│   │   ├── supabase.client.ts      # Supabase browser client (anon key)
│   │   ├── constants.ts            # TRACKED_FRIENDS, TWITCH_MAP, MAP_COLORS
│   │   └── types.ts                # TypeScript interfaces
│   ├── router.tsx                  # TanStack Router config
│   └── styles/
│       └── app.css                 # Tailwind v4 + custom design tokens
├── tests/
│   ├── lib/
│   │   ├── faceit.test.ts          # FACEIT client unit tests
│   │   ├── twitch.test.ts          # Twitch client unit tests
│   │   └── constants.test.ts       # Constants/mapping tests
│   └── setup.ts                    # Vitest setup
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── vite.config.ts                  # Vite + TanStack Start plugin
├── tsconfig.json
├── package.json
├── .env.local                      # Local env vars (gitignored)
├── .env.example                    # Template for env vars
└── .gitignore
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example`, `.env.local`
- Create: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/router.tsx`
- Create: `src/styles/app.css`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/ventsislavnikolov/Projects/ventsislavnikolov/faceit-match
git init
```

- [ ] **Step 2: Create package.json and install dependencies**

```bash
npm init -y
```

Then edit `package.json`:
```json
{
  "name": "faceit-match",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Install deps:
```bash
npm install @tanstack/react-start @tanstack/react-router @tanstack/react-query react react-dom @supabase/supabase-js
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest tailwindcss @tailwindcss/vite
```

> **Note:** Check `https://tanstack.com/start/latest/docs/framework/react/build-from-scratch` for the latest install instructions — TanStack Start is in RC and deps may change. Use Context7 MCP for up-to-date docs.

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tanstackStart(), react(), tailwindcss()],
});
```

> **Note:** Plugin order matters — check TanStack Start docs. `tanstackStart()` must come first.

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.output/
dist/
.env.local
.env*.local
.vinxi/
.superpowers/
src/routeTree.gen.ts
```

- [ ] **Step 6: Create .env.example and .env.local**

`.env.example`:
```
FACEIT_API_KEY=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` — populate with actual values. FACEIT API key from developer portal. Supabase values from Supabase MCP after creating the project. Twitch values from dev.twitch.tv. `VITE_` vars should mirror their non-prefixed counterparts.

- [ ] **Step 7: Create src/styles/app.css with Tailwind + design tokens**

```css
@import "tailwindcss";

@theme {
  --color-bg: #050505;
  --color-bg-card: #0a0a0a;
  --color-bg-elevated: #111111;
  --color-accent: #00ff88;
  --color-error: #ff4444;
  --color-twitch: #9146FF;
  --color-text: #e0e0e0;
  --color-text-muted: #888888;
  --color-text-dim: #444444;
  --color-border: #1a1a1a;

  --color-map-inferno: #cc9944;
  --color-map-dust2: #ccaa88;
  --color-map-nuke: #44aacc;
  --color-map-ancient: #55aa77;
  --color-map-mirage: #aa77cc;
  --color-map-anubis: #77aa55;
  --color-map-vertigo: #55aacc;
  --color-map-fallback: #888888;

  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

- [ ] **Step 8: Create src/router.tsx**

```typescript
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
```

- [ ] **Step 9: Create src/routes/__root.tsx**

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Meta, Scripts } from "@tanstack/react-start";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "~/styles/app.css";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootLayout,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FACEIT Live" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap",
      },
    ],
  }),
});

function RootLayout() {
  return (
    <html lang="en" className="dark">
      <head>
        <Meta />
      </head>
      <body className="bg-bg text-text font-mono min-h-screen">
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

> **Note:** Check TanStack Start docs for the correct `head` / `Meta` / `Scripts` pattern — it may have changed since RC.

- [ ] **Step 10: Create src/routes/index.tsx (placeholder)**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-accent text-2xl font-bold">FACEIT LIVE</h1>
    </div>
  );
}
```

- [ ] **Step 11: Verify dev server starts**

```bash
npm run dev
```

Expected: Dev server starts, visiting `http://localhost:3000` shows "FACEIT LIVE" in green on dark background.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold TanStack Start project with Tailwind v4 and design tokens"
```

---

## Task 2: Constants, Types, and Configuration

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/types.ts`
- Test: `tests/lib/constants.test.ts`, `tests/setup.ts`

- [ ] **Step 1: Create tests/setup.ts**

```typescript
// Vitest setup — empty for now, placeholder for global test config
```

Add to `vite.config.ts` (inside defineConfig):
```typescript
test: {
  include: ["tests/**/*.test.ts"],
  setupFiles: ["tests/setup.ts"],
},
```

- [ ] **Step 2: Write the test for constants**

`tests/lib/constants.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  TRACKED_FRIENDS,
  MY_FACEIT_ID,
  TWITCH_MAP,
  MAP_COLORS,
  getMapColor,
  getTwitchChannel,
} from "~/lib/constants";

describe("constants", () => {
  it("has 19 tracked friends", () => {
    expect(TRACKED_FRIENDS).toHaveLength(19);
  });

  it("MY_FACEIT_ID is soavarice", () => {
    expect(MY_FACEIT_ID).toBe("15844c99-d26e-419e-bd14-30908f502c03");
  });

  it("TWITCH_MAP maps FACEIT IDs to Twitch channels", () => {
    expect(TWITCH_MAP["ad8034c1-6324-4080-b28e-dbf04239670a"]).toBe("bachiyski");
    expect(TWITCH_MAP["65c93ab1-d2b2-416c-a5d1-d45452c9517d"]).toBe("kasheto88");
    expect(TWITCH_MAP["15844c99-d26e-419e-bd14-30908f502c03"]).toBe("soavarice");
  });

  it("getMapColor returns correct colors", () => {
    expect(getMapColor("de_inferno")).toBe("#cc9944");
    expect(getMapColor("de_dust2")).toBe("#ccaa88");
    expect(getMapColor("de_unknown")).toBe("#888888");
  });

  it("getTwitchChannel returns channel or null", () => {
    expect(getTwitchChannel("ad8034c1-6324-4080-b28e-dbf04239670a")).toBe("bachiyski");
    expect(getTwitchChannel("some-random-id")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Create src/lib/constants.ts**

```typescript
export const TRACKED_FRIENDS = [
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
] as const;

export const MY_FACEIT_ID = "15844c99-d26e-419e-bd14-30908f502c03";
export const MY_NICKNAME = "soavarice";

export const TWITCH_MAP: Record<string, string> = {
  "ad8034c1-6324-4080-b28e-dbf04239670a": "bachiyski",   // TibaBG
  "65c93ab1-d2b2-416c-a5d1-d45452c9517d": "kasheto88",   // F1aw1esss
  "15844c99-d26e-419e-bd14-30908f502c03": "soavarice",    // soavarice
};

export const MAP_COLORS: Record<string, string> = {
  de_inferno: "#cc9944",
  de_dust2: "#ccaa88",
  de_nuke: "#44aacc",
  de_ancient: "#55aa77",
  de_mirage: "#aa77cc",
  de_anubis: "#77aa55",
  de_vertigo: "#55aacc",
};

const FALLBACK_MAP_COLOR = "#888888";

export function getMapColor(map: string): string {
  return MAP_COLORS[map] ?? FALLBACK_MAP_COLOR;
}

export function getTwitchChannel(faceitId: string): string | null {
  return TWITCH_MAP[faceitId] ?? null;
}
```

- [ ] **Step 5: Create src/lib/types.ts**

```typescript
export interface FaceitPlayer {
  faceitId: string;
  nickname: string;
  avatar: string;
  elo: number;
  skillLevel: number;
  country: string;
}

export interface FriendWithStats extends FaceitPlayer {
  lifetimeKd: number;
  lifetimeHs: number;
  lifetimeAdr: number;
  winRate: number;
  totalMatches: number;
  recentResults: boolean[]; // true = win, false = loss (last 5)
  twitchChannel: string | null;
  isPlaying: boolean;
  currentMatchId: string | null;
}

export interface LiveMatch {
  matchId: string;
  status: string;
  map: string;
  score: { faction1: number; faction2: number };
  startedAt: number;
  teams: {
    faction1: MatchTeam;
    faction2: MatchTeam;
  };
  friendFaction: "faction1" | "faction2";
  friendIds: string[];
}

export interface MatchTeam {
  teamId: string;
  name: string;
  roster: MatchPlayer[];
}

export interface MatchPlayer {
  playerId: string;
  nickname: string;
  avatar: string;
  skillLevel: number;
}

export interface MatchPlayerStats {
  playerId: string;
  nickname: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  mvps: number;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  result: boolean; // win or loss
}

export interface MatchWithStats {
  matchId: string;
  map: string;
  score: string;
  status: string;
  startedAt: number;
  finishedAt: number | null;
  players: MatchPlayerStats[];
}

export interface TwitchStream {
  channel: string;
  faceitId: string;
  isLive: boolean;
  viewerCount: number;
  title: string;
  thumbnailUrl: string;
}
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts tests/
git commit -m "feat: add constants, types, and Twitch/map mappings"
```

---

## Task 3: Supabase Setup + Database Schema

**Files:**
- Create: `src/lib/supabase.server.ts`, `src/lib/supabase.client.ts`
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase project via MCP**

Use the Supabase MCP to create a new project named `faceit-match`. Note the project URL and keys.

- [ ] **Step 2: Create database migration file**

`supabase/migrations/001_initial_schema.sql`:
```sql
-- App user profiles (links to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- FACEIT friends being tracked
CREATE TABLE tracked_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_id TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  elo INTEGER,
  skill_level INTEGER,
  win_rate NUMERIC(5,2),
  lifetime_kd NUMERIC(4,2),
  lifetime_hs INTEGER,
  lifetime_adr NUMERIC(5,1),
  total_matches INTEGER,
  twitch_channel TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tracked_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tracked_friends" ON tracked_friends
  FOR SELECT USING (auth.role() = 'authenticated');

-- Matches (live and historical)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faceit_match_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONGOING',
  map TEXT,
  score TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  team_roster JSONB,
  opponent_roster JSONB,
  match_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read matches" ON matches
  FOR SELECT USING (auth.role() = 'authenticated');

-- Per-player stats for each match
CREATE TABLE match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  faceit_player_id TEXT NOT NULL,
  nickname TEXT,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  headshots INTEGER DEFAULT 0,
  mvps INTEGER DEFAULT 0,
  kd_ratio NUMERIC(4,2),
  adr NUMERIC(5,1),
  hs_percent INTEGER,
  clutches INTEGER DEFAULT 0,      -- reserved: FACEIT API may add this later
  triple_kills INTEGER DEFAULT 0,
  quadro_kills INTEGER DEFAULT 0,
  penta_kills INTEGER DEFAULT 0,
  elo_before INTEGER,
  elo_after INTEGER,
  elo_delta INTEGER,
  win BOOLEAN,
  map TEXT,
  played_at TIMESTAMPTZ,
  UNIQUE(match_id, faceit_player_id)
);

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read match_player_stats" ON match_player_stats
  FOR SELECT USING (auth.role() = 'authenticated');

-- Indexes for common queries
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_faceit_id ON matches(faceit_match_id);
CREATE INDEX idx_match_stats_player ON match_player_stats(faceit_player_id);
CREATE INDEX idx_match_stats_match ON match_player_stats(match_id);
CREATE INDEX idx_tracked_friends_faceit ON tracked_friends(faceit_id);
```

- [ ] **Step 3: Run migration via Supabase MCP**

Use Supabase MCP to execute the SQL migration against the project.

- [ ] **Step 4: Create src/lib/supabase.server.ts**

```typescript
import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}
```

- [ ] **Step 5: Create src/lib/supabase.client.ts**

```typescript
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  client = createClient(url, key);
  return client;
}
```

> **Note:** TanStack Start uses Vite — client-side env vars must be prefixed with `VITE_`. Update `.env.local` to also include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 6: Update .env.local and .env.example**

Add to both files:
```
VITE_SUPABASE_URL=          # Same as SUPABASE_URL, for client-side access
VITE_SUPABASE_ANON_KEY=     # Same as SUPABASE_ANON_KEY, for client-side access
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.server.ts src/lib/supabase.client.ts supabase/ .env.example
git commit -m "feat: add Supabase clients and initial database schema"
```

---

## Task 4: FACEIT API Client

**Files:**
- Create: `src/lib/faceit.ts`
- Test: `tests/lib/faceit.test.ts`

- [ ] **Step 1: Write tests for FACEIT response parsing**

`tests/lib/faceit.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parsePlayerProfile, parseLifetimeStats, parseMatchStats } from "~/lib/faceit";

describe("parsePlayerProfile", () => {
  it("extracts player fields from API response", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      avatar: "https://cdn.faceit.com/test.jpg",
      country: "bg",
      games: {
        cs2: { faceit_elo: 1689, skill_level: 8 },
      },
    };
    const result = parsePlayerProfile(raw);
    expect(result).toEqual({
      faceitId: "abc-123",
      nickname: "TestPlayer",
      avatar: "https://cdn.faceit.com/test.jpg",
      elo: 1689,
      skillLevel: 8,
      country: "bg",
    });
  });

  it("handles missing cs2 game data", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      avatar: "",
      country: "us",
      games: {},
    };
    const result = parsePlayerProfile(raw);
    expect(result.elo).toBe(0);
    expect(result.skillLevel).toBe(0);
  });
});

describe("parseLifetimeStats", () => {
  it("extracts lifetime stats from API response", () => {
    const raw = {
      lifetime: {
        "Average K/D Ratio": "1.32",
        "Average Headshots %": "58",
        "ADR": "98",
        "Win Rate %": "54",
        "Matches": "910",
        "Recent Results": ["1", "1", "0", "1", "0"],
      },
    };
    const result = parseLifetimeStats(raw);
    expect(result.lifetimeKd).toBe(1.32);
    expect(result.lifetimeHs).toBe(58);
    expect(result.lifetimeAdr).toBe(98);
    expect(result.winRate).toBe(54);
    expect(result.totalMatches).toBe(910);
    expect(result.recentResults).toEqual([true, true, false, true, false]);
  });
});

describe("parseMatchStats", () => {
  it("extracts per-player stats from match stats response", () => {
    const raw = {
      player_id: "abc-123",
      nickname: "TestPlayer",
      player_stats: {
        Kills: "18",
        Deaths: "8",
        Assists: "4",
        Headshots: "10",
        MVPs: "3",
        "K/D Ratio": "2.25",
        ADR: "112.3",
        "Headshots %": "55",
        "Triple Kills": "2",
        "Quadro Kills": "1",
        "Penta Kills": "0",
        Result: "1",
      },
    };
    const result = parseMatchStats(raw);
    expect(result.kills).toBe(18);
    expect(result.deaths).toBe(8);
    expect(result.kdRatio).toBe(2.25);
    expect(result.adr).toBe(112.3);
    expect(result.result).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `parsePlayerProfile` etc. not found.

- [ ] **Step 3: Implement src/lib/faceit.ts**

```typescript
import type { FaceitPlayer, MatchPlayerStats } from "./types";

const BASE_URL = "https://open.faceit.com/data/v4";

function getApiKey(): string {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error("Missing FACEIT_API_KEY");
  return key;
}

async function faceitFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`FACEIT API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

export function parsePlayerProfile(raw: any): FaceitPlayer {
  const cs2 = raw.games?.cs2;
  return {
    faceitId: raw.player_id,
    nickname: raw.nickname,
    avatar: raw.avatar || "",
    elo: cs2?.faceit_elo ?? 0,
    skillLevel: cs2?.skill_level ?? 0,
    country: raw.country || "",
  };
}

export function parseLifetimeStats(raw: any) {
  const lt = raw.lifetime || {};
  return {
    lifetimeKd: parseFloat(lt["Average K/D Ratio"]) || 0,
    lifetimeHs: parseInt(lt["Average Headshots %"]) || 0,
    lifetimeAdr: parseFloat(lt["ADR"]) || 0,
    winRate: parseInt(lt["Win Rate %"]) || 0,
    totalMatches: parseInt(lt["Matches"]) || 0,
    recentResults: (lt["Recent Results"] || []).map((r: string) => r === "1"),
  };
}

export function parseMatchStats(raw: any): MatchPlayerStats {
  const s = raw.player_stats || {};
  return {
    playerId: raw.player_id,
    nickname: raw.nickname,
    kills: parseInt(s["Kills"]) || 0,
    deaths: parseInt(s["Deaths"]) || 0,
    assists: parseInt(s["Assists"]) || 0,
    headshots: parseInt(s["Headshots"]) || 0,
    mvps: parseInt(s["MVPs"]) || 0,
    kdRatio: parseFloat(s["K/D Ratio"]) || 0,
    adr: parseFloat(s["ADR"]) || 0,
    hsPercent: parseInt(s["Headshots %"]) || 0,
    tripleKills: parseInt(s["Triple Kills"]) || 0,
    quadroKills: parseInt(s["Quadro Kills"]) || 0,
    pentaKills: parseInt(s["Penta Kills"]) || 0,
    result: s["Result"] === "1",
  };
}

export async function fetchPlayer(playerId: string): Promise<FaceitPlayer> {
  const data = await faceitFetch(`/players/${playerId}`);
  return parsePlayerProfile(data);
}

export async function fetchPlayerLifetimeStats(playerId: string) {
  const data = await faceitFetch(`/players/${playerId}/stats/cs2`);
  return parseLifetimeStats(data);
}

export async function fetchPlayerHistory(playerId: string, limit = 30) {
  const data = (await faceitFetch(
    `/players/${playerId}/history?game=cs2&offset=0&limit=${limit}`
  )) as any;
  return data.items || [];
}

export async function fetchMatch(matchId: string) {
  return faceitFetch(`/matches/${matchId}`) as any;
}

export async function fetchMatchStats(matchId: string) {
  return faceitFetch(`/matches/${matchId}/stats`) as any;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/faceit.ts tests/lib/faceit.test.ts
git commit -m "feat: add FACEIT Open API client with response parsers"
```

---

## Task 5: Twitch API Client

**Files:**
- Create: `src/lib/twitch.ts`
- Test: `tests/lib/twitch.test.ts`

- [ ] **Step 1: Write test for Twitch response parsing**

`tests/lib/twitch.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseTwitchStreams } from "~/lib/twitch";
import { TWITCH_MAP } from "~/lib/constants";

describe("parseTwitchStreams", () => {
  it("maps live Twitch data to TwitchStream objects", () => {
    const apiResponse = {
      data: [
        {
          user_login: "bachiyski",
          viewer_count: 142,
          title: "CS2 Ranked",
          thumbnail_url: "https://thumb.jpg",
        },
      ],
    };
    const result = parseTwitchStreams(apiResponse, TWITCH_MAP);
    expect(result).toHaveLength(3); // all 3 channels
    const live = result.find((s) => s.channel === "bachiyski");
    expect(live?.isLive).toBe(true);
    expect(live?.viewerCount).toBe(142);
    const offline = result.find((s) => s.channel === "kasheto88");
    expect(offline?.isLive).toBe(false);
  });

  it("handles empty data (no one live)", () => {
    const result = parseTwitchStreams({ data: [] }, TWITCH_MAP);
    expect(result.every((s) => !s.isLive)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement src/lib/twitch.ts**

```typescript
import type { TwitchStream } from "./types";

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_API_URL = "https://api.twitch.tv/helix";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");

  const res = await fetch(TWITCH_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch auth error: ${res.status}`);
  const data = (await res.json()) as any;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000, // refresh 1 min early
  };
  return cachedToken.token;
}

export function parseTwitchStreams(
  apiResponse: any,
  twitchMap: Record<string, string>
): TwitchStream[] {
  const liveStreams = apiResponse.data || [];
  const liveByLogin = new Map(
    liveStreams.map((s: any) => [s.user_login.toLowerCase(), s])
  );

  // Reverse map: channel -> faceitId
  const channelToFaceit = new Map(
    Object.entries(twitchMap).map(([faceitId, channel]) => [channel, faceitId])
  );

  return Object.entries(twitchMap).map(([faceitId, channel]) => {
    const stream = liveByLogin.get(channel.toLowerCase());
    return {
      channel,
      faceitId,
      isLive: !!stream,
      viewerCount: stream?.viewer_count ?? 0,
      title: stream?.title ?? "",
      thumbnailUrl: stream?.thumbnail_url ?? "",
    };
  });
}

export async function fetchLiveStreams(
  channels: string[]
): Promise<any> {
  const token = await getAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const params = channels.map((c) => `user_login=${c}`).join("&");
  const res = await fetch(`${TWITCH_API_URL}/streams?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    // Token might be expired, clear cache and retry once
    if (res.status === 401) {
      cachedToken = null;
      return fetchLiveStreams(channels);
    }
    throw new Error(`Twitch API error: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/twitch.ts tests/lib/twitch.test.ts
git commit -m "feat: add Twitch Helix API client with stream parsing"
```

---

## Task 6: API Routes — Friends + Live Matches + Twitch

**Files:**
- Create: `src/routes/api/friends.ts`
- Create: `src/routes/api/matches.live.ts`
- Create: `src/routes/api/matches.$matchId.ts`
- Create: `src/routes/api/stats.$playerId.ts`
- Create: `src/routes/api/twitch.live.ts`

> **Note:** These are TanStack Start API routes using `createAPIFileRoute`. Check the latest TanStack Start docs for the exact API route file convention — it may use a different pattern than page routes. Use Context7 MCP for reference.

- [ ] **Step 1: Create /api/friends route**

`src/routes/api/friends.ts`:
```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { TRACKED_FRIENDS } from "~/lib/constants";
import { fetchPlayer, fetchPlayerLifetimeStats } from "~/lib/faceit";
import { getTwitchChannel } from "~/lib/constants";
import { createServerSupabase } from "~/lib/supabase.server";
import type { FriendWithStats } from "~/lib/types";

export const APIRoute = createAPIFileRoute("/api/friends")({
  GET: async () => {
    const supabase = createServerSupabase();
    const friends: FriendWithStats[] = [];
    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

    // Check Supabase cache first
    const { data: cached } = await supabase
      .from("tracked_friends")
      .select("*")
      .order("nickname");

    const now = Date.now();
    const staleIds = new Set<string>();
    const freshFriends: FriendWithStats[] = [];

    for (const id of TRACKED_FRIENDS) {
      const row = cached?.find((r: any) => r.faceit_id === id);
      if (row && row.updated_at && (now - new Date(row.updated_at).getTime()) < CACHE_TTL_MS) {
        freshFriends.push({
          faceitId: row.faceit_id,
          nickname: row.nickname,
          avatar: row.avatar_url || "",
          elo: row.elo || 0,
          skillLevel: row.skill_level || 0,
          country: "",
          lifetimeKd: parseFloat(row.lifetime_kd) || 0,
          lifetimeHs: row.lifetime_hs || 0,
          lifetimeAdr: parseFloat(row.lifetime_adr) || 0,
          winRate: parseFloat(row.win_rate) || 0,
          totalMatches: row.total_matches || 0,
          recentResults: [],
          twitchChannel: row.twitch_channel,
          isPlaying: false,
          currentMatchId: null,
        });
      } else {
        staleIds.add(id);
      }
    }

    // Only fetch stale friends from FACEIT API
    const staleArray = [...staleIds];
    for (let i = 0; i < staleArray.length; i += 5) {
      const batch = staleArray.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const [player, stats] = await Promise.all([
            fetchPlayer(id),
            fetchPlayerLifetimeStats(id),
          ]);
          return {
            ...player,
            ...stats,
            twitchChannel: getTwitchChannel(id),
            isPlaying: false,
            currentMatchId: null,
          } satisfies FriendWithStats;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          friends.push(result.value);
          // Upsert to Supabase
          await supabase.from("tracked_friends").upsert(
            {
              faceit_id: result.value.faceitId,
              nickname: result.value.nickname,
              avatar_url: result.value.avatar,
              elo: result.value.elo,
              skill_level: result.value.skillLevel,
              win_rate: result.value.winRate,
              lifetime_kd: result.value.lifetimeKd,
              lifetime_hs: result.value.lifetimeHs,
              lifetime_adr: result.value.lifetimeAdr,
              total_matches: result.value.totalMatches,
              twitch_channel: result.value.twitchChannel,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "faceit_id" }
          );
        }
      }
    }

    return Response.json([...freshFriends, ...friends]);
  },
});
```

- [ ] **Step 2: Create /api/matches/live route**

`src/routes/api/matches.live.ts`:
```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { TRACKED_FRIENDS } from "~/lib/constants";
import { fetchPlayerHistory, fetchMatch } from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";
import type { LiveMatch } from "~/lib/types";

export const APIRoute = createAPIFileRoute("/api/matches/live")({
  GET: async () => {
    const supabase = createServerSupabase();
    const liveMatches: LiveMatch[] = [];

    // Step 1: Fetch latest match ID for each friend (parallel)
    const historyResults = await Promise.allSettled(
      TRACKED_FRIENDS.map(async (friendId) => {
        const history = await fetchPlayerHistory(friendId, 1);
        if (!history.length) return null;
        return { matchId: history[0].match_id, friendId };
      })
    );

    // Step 2: Deduplicate match IDs (sequential, no race condition)
    const uniqueMatches = new Map<string, string[]>();
    for (const result of historyResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { matchId, friendId } = result.value;
      if (!uniqueMatches.has(matchId)) {
        uniqueMatches.set(matchId, []);
      }
      uniqueMatches.get(matchId)!.push(friendId);
    }

    // Step 3: Fetch match details for unique IDs (parallel)
    const matchResults = await Promise.allSettled(
      [...uniqueMatches.entries()].map(async ([matchId]) => {
        const match = await fetchMatch(matchId);
        if (match.status !== "ONGOING" && match.status !== "READY" &&
            match.status !== "VOTING" && match.status !== "CONFIGURING") {
          return null;
        }
        return { match, friendId: uniqueMatches.get(matchId)![0] };
      })
    );

    const results = matchResults;

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { match, friendId } = result.value;

      // Find which faction has our friends
      const friendIds: string[] = [];
      let friendFaction: "faction1" | "faction2" = "faction1";
      for (const faction of ["faction1", "faction2"] as const) {
        const roster = match.teams?.[faction]?.roster || [];
        const found = roster.filter((p: any) =>
          TRACKED_FRIENDS.includes(p.player_id)
        );
        if (found.length > 0) {
          friendFaction = faction;
          friendIds.push(...found.map((p: any) => p.player_id));
        }
      }

      const liveMatch: LiveMatch = {
        matchId: match.match_id,
        status: match.status,
        map: match.voting?.map?.pick?.[0] || "unknown",
        score: match.results?.score || { faction1: 0, faction2: 0 },
        startedAt: match.started_at || 0,
        teams: {
          faction1: {
            teamId: match.teams.faction1.faction_id,
            name: match.teams.faction1.leader || "Team 1",
            roster: (match.teams.faction1.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
          faction2: {
            teamId: match.teams.faction2.faction_id,
            name: match.teams.faction2.leader || "Team 2",
            roster: (match.teams.faction2.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
        },
        friendFaction,
        friendIds,
      };
      liveMatches.push(liveMatch);

      // Upsert match to Supabase
      await supabase.from("matches").upsert(
        {
          faceit_match_id: match.match_id,
          status: match.status,
          map: liveMatch.map,
          started_at: match.started_at
            ? new Date(match.started_at * 1000).toISOString()
            : null,
          match_data: match,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );
    }

    return Response.json(liveMatches);
  },
});
```

- [ ] **Step 3: Create /api/matches/:matchId route**

`src/routes/api/matches.$matchId.ts`:
```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchMatch, fetchMatchStats, parseMatchStats } from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";

export const APIRoute = createAPIFileRoute("/api/matches/$matchId")({
  GET: async ({ params }) => {
    const { matchId } = params;
    const [match, statsData] = await Promise.all([
      fetchMatch(matchId),
      fetchMatchStats(matchId).catch(() => null),
    ]);

    let players: any[] = [];
    if (statsData?.rounds?.[0]?.teams) {
      for (const team of statsData.rounds[0].teams) {
        for (const player of team.players || []) {
          players.push(parseMatchStats(player));
        }
      }
    }

    const result = {
      matchId: match.match_id,
      map: match.voting?.map?.pick?.[0] || statsData?.rounds?.[0]?.round_stats?.Map || "unknown",
      score: statsData?.rounds?.[0]?.round_stats?.Score || "",
      status: match.status,
      startedAt: match.started_at || 0,
      finishedAt: match.finished_at || null,
      players,
    };

    // Store stats in Supabase if match is finished
    if (match.status === "FINISHED" || match.status === "finished") {
      const supabase = createServerSupabase();
      await supabase.from("matches").upsert(
        {
          faceit_match_id: matchId,
          status: "FINISHED",
          map: result.map,
          score: result.score,
          finished_at: match.finished_at
            ? new Date(match.finished_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );

      // Get match DB id for stats
      const { data: matchRow } = await supabase
        .from("matches")
        .select("id")
        .eq("faceit_match_id", matchId)
        .single();

      if (matchRow) {
        for (const p of players) {
          await supabase.from("match_player_stats").upsert(
            {
              match_id: matchRow.id,
              faceit_player_id: p.playerId,
              nickname: p.nickname,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              headshots: p.headshots,
              mvps: p.mvps,
              kd_ratio: p.kdRatio,
              adr: p.adr,
              hs_percent: p.hsPercent,
              triple_kills: p.tripleKills,
              quadro_kills: p.quadroKills,
              penta_kills: p.pentaKills,
              win: p.result,
              map: result.map,
              played_at: match.finished_at
                ? new Date(match.finished_at * 1000).toISOString()
                : null,
            },
            { onConflict: "match_id,faceit_player_id" }
          );
        }
      }
    }

    return Response.json(result);
  },
});
```

- [ ] **Step 4: Create /api/stats/:playerId route**

`src/routes/api/stats.$playerId.ts`:
```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchPlayerHistory, fetchMatchStats, parseMatchStats } from "~/lib/faceit";

export const APIRoute = createAPIFileRoute("/api/stats/$playerId")({
  GET: async ({ params }) => {
    const { playerId } = params;
    const history = await fetchPlayerHistory(playerId, 30);

    const matches = await Promise.allSettled(
      history.map(async (h: any) => {
        const stats = await fetchMatchStats(h.match_id);
        const round = stats.rounds?.[0];
        if (!round) return null;

        // Find this player in the stats
        for (const team of round.teams || []) {
          const player = (team.players || []).find(
            (p: any) => p.player_id === playerId
          );
          if (player) {
            return {
              matchId: h.match_id,
              map: round.round_stats?.Map || "unknown",
              score: round.round_stats?.Score || "",
              startedAt: h.started_at,
              finishedAt: h.finished_at,
              ...parseMatchStats(player),
            };
          }
        }
        return null;
      })
    );

    const results = matches
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r: any) => r.value);

    return Response.json(results);
  },
});
```

- [ ] **Step 5: Create /api/twitch/live route**

`src/routes/api/twitch.live.ts`:
```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchLiveStreams, parseTwitchStreams } from "~/lib/twitch";
import { TWITCH_MAP } from "~/lib/constants";

export const APIRoute = createAPIFileRoute("/api/twitch/live")({
  GET: async () => {
    const channels = Object.values(TWITCH_MAP);
    const data = await fetchLiveStreams(channels);
    const streams = parseTwitchStreams(data, TWITCH_MAP);
    return Response.json(streams);
  },
});
```

- [ ] **Step 6: Verify API routes work**

Start dev server and test:
```bash
npm run dev
# In another terminal:
curl http://localhost:3000/api/twitch/live | python3 -m json.tool
curl http://localhost:3000/api/friends | python3 -m json.tool | head -30
```

Expected: JSON responses with friend data and Twitch stream info.

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/
git commit -m "feat: add API routes for friends, live matches, stats, and Twitch"
```

---

## Task 7: TanStack Query Hooks

**Files:**
- Create: `src/hooks/useFriends.ts`, `src/hooks/useLiveMatches.ts`, `src/hooks/usePlayerStats.ts`, `src/hooks/useTwitchLive.ts`

- [ ] **Step 1: Create useFriends hook**

`src/hooks/useFriends.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import type { FriendWithStats } from "~/lib/types";

export function useFriends() {
  return useQuery<FriendWithStats[]>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Create useLiveMatches hook**

`src/hooks/useLiveMatches.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import type { LiveMatch } from "~/lib/types";

export function useLiveMatches() {
  const query = useQuery<LiveMatch[]>({
    queryKey: ["matches", "live"],
    queryFn: async () => {
      const res = await fetch("/api/matches/live");
      if (!res.ok) throw new Error("Failed to fetch live matches");
      return res.json();
    },
    refetchInterval: (query) => {
      // Poll faster when matches are active
      const data = query.state.data;
      return data && data.length > 0 ? 30_000 : 5 * 60 * 1000;
    },
    staleTime: 20_000,
  });
  return query;
}
```

- [ ] **Step 3: Create usePlayerStats hook**

`src/hooks/usePlayerStats.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import type { MatchWithStats } from "~/lib/types";

export function usePlayerStats(playerId: string | null) {
  return useQuery<MatchWithStats[]>({
    queryKey: ["stats", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/${playerId}`);
      if (!res.ok) throw new Error("Failed to fetch player stats");
      return res.json();
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Create useTwitchLive hook**

`src/hooks/useTwitchLive.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import type { TwitchStream } from "~/lib/types";

export function useTwitchLive() {
  return useQuery<TwitchStream[]>({
    queryKey: ["twitch", "live"],
    queryFn: async () => {
      const res = await fetch("/api/twitch/live");
      if (!res.ok) throw new Error("Failed to fetch Twitch streams");
      return res.json();
    },
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add TanStack Query hooks for friends, matches, stats, and Twitch"
```

---

## Task 8: Auth — Login Page + Auth Guard

**Files:**
- Create: `src/components/LoginForm.tsx`
- Modify: `src/routes/index.tsx`
- Create: `src/routes/_authed.tsx`

- [ ] **Step 1: Create LoginForm component**

`src/components/LoginForm.tsx`:
```tsx
import { useState } from "react";
import { getSupabaseClient } from "~/lib/supabase.client";
import { useRouter } from "@tanstack/react-router";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    if (isSignUp) {
      setError("Check your email for a confirmation link.");
      return;
    }

    router.navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
      />
      {error && <p className="text-error text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
      </button>
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="text-text-muted text-sm hover:text-accent"
      >
        {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Update index.tsx (login page)**

`src/routes/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/components/LoginForm";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <div className="text-center">
        <h1 className="text-accent text-3xl font-bold">
          FACEIT<span className="text-text">LIVE</span>
        </h1>
        <p className="text-text-muted text-sm mt-2">CS2 Friends Dashboard</p>
      </div>
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 3: Create auth layout route**

`src/routes/_authed.tsx`:
```tsx
import { createFileRoute, Outlet, Link, redirect, useRouter } from "@tanstack/react-router";
import { getSupabaseClient } from "~/lib/supabase.client";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex justify-between items-center px-4 py-2.5 bg-bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-accent font-bold text-base">
            FACEIT<span className="text-text">LIVE</span>
          </span>
          <div className="flex gap-3 text-xs">
            <Link to="/dashboard" activeProps={{ className: "text-accent border-b border-accent pb-0.5" }} inactiveProps={{ className: "text-text-muted hover:text-accent" }}>Dashboard</Link>
            <Link to="/history" activeProps={{ className: "text-accent border-b border-accent pb-0.5" }} inactiveProps={{ className: "text-text-muted hover:text-accent" }}>History</Link>
          </div>
        </div>
        <button onClick={handleSignOut} className="text-text-muted text-xs hover:text-error">
          Sign Out
        </button>
      </nav>
      <Outlet />
    </div>
  );
}
```

> **Note:** Check TanStack Start docs for the correct `beforeLoad` pattern and how redirects work with file-based routing. Layout routes use `_prefix` naming.

- [ ] **Step 4: Verify auth flow**

```bash
npm run dev
```

Visit `http://localhost:3000` — should show login form. Trying to visit `/dashboard` should redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginForm.tsx src/routes/index.tsx src/routes/_authed.tsx
git commit -m "feat: add Supabase auth with login page and route guard"
```

---

## Task 9: Dashboard — Friend Sidebar Components

**Files:**
- Create: `src/components/StreakBar.tsx`, `src/components/FriendCard.tsx`, `src/components/FriendsSidebar.tsx`, `src/components/MapBadge.tsx`

- [ ] **Step 1: Create StreakBar component**

`src/components/StreakBar.tsx`:
```tsx
interface StreakBarProps {
  results: boolean[]; // true = win, false = loss
}

export function StreakBar({ results }: StreakBarProps) {
  const wins = results.filter(Boolean).length;
  const losses = results.length - wins;
  return (
    <div className="flex items-center gap-1">
      {results.map((win, i) => (
        <span
          key={i}
          className={`w-3.5 h-1.5 rounded-sm ${win ? "bg-accent" : "bg-error"}`}
        />
      ))}
      <span className="text-text-dim text-[10px] ml-1">
        {wins}W {losses}L
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create MapBadge component**

`src/components/MapBadge.tsx`:
```tsx
import { getMapColor } from "~/lib/constants";

interface MapBadgeProps {
  map: string;
}

export function MapBadge({ map }: MapBadgeProps) {
  const color = getMapColor(map);
  const name = map.replace("de_", "");
  return (
    <span
      className="text-xs px-2 py-0.5 rounded"
      style={{ color, backgroundColor: `${color}22` }}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 3: Create FriendCard component**

`src/components/FriendCard.tsx`:
```tsx
import type { FriendWithStats } from "~/lib/types";
import { StreakBar } from "./StreakBar";

interface FriendCardProps {
  friend: FriendWithStats;
  isSelected: boolean;
  isLive: boolean; // Twitch live
  onClick: () => void;
}

export function FriendCard({ friend, isSelected, isLive, onClick }: FriendCardProps) {
  const isPlaying = friend.isPlaying;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg p-2.5 cursor-pointer transition-colors ${
        isPlaying
          ? "bg-accent/5 border border-accent/30"
          : "bg-bg-elevated border border-transparent"
      } ${isSelected ? "ring-1 ring-accent" : ""} hover:border-accent/40`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isPlaying
              ? "bg-accent/15 border-2 border-accent text-accent"
              : "bg-bg-card border border-border text-text-dim"
          }`}
        >
          {friend.nickname[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold truncate ${isPlaying ? "text-accent" : "text-text-muted"}`}>
              {friend.nickname}
            </span>
            {isLive && (
              <span className="text-[9px] text-twitch bg-twitch/20 px-1.5 rounded">LIVE</span>
            )}
          </div>
          <div className="text-[10px] text-text-muted">
            ELO {friend.elo.toLocaleString()} · Lvl {friend.skillLevel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {[
          { label: "K/D", value: friend.lifetimeKd.toFixed(2), highlight: friend.lifetimeKd >= 1.2 },
          { label: "HS%", value: `${friend.lifetimeHs}%`, highlight: friend.lifetimeHs >= 55 },
          { label: "ADR", value: friend.lifetimeAdr.toFixed(0), highlight: false },
          { label: "WR", value: `${friend.winRate}%`, highlight: friend.winRate >= 55 },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded px-1.5 py-1">
            <div className="text-[9px] text-text-dim uppercase">{stat.label}</div>
            <div className={`text-sm font-bold ${stat.highlight ? "text-accent" : "text-text"}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <StreakBar results={friend.recentResults} />
    </div>
  );
}
```

- [ ] **Step 4: Create FriendsSidebar component**

`src/components/FriendsSidebar.tsx`:
```tsx
import type { FriendWithStats, TwitchStream } from "~/lib/types";
import { FriendCard } from "./FriendCard";

interface FriendsSidebarProps {
  friends: FriendWithStats[];
  twitchStreams: TwitchStream[];
  selectedFriendId: string | null;
  onSelectFriend: (id: string) => void;
}

export function FriendsSidebar({
  friends,
  twitchStreams,
  selectedFriendId,
  onSelectFriend,
}: FriendsSidebarProps) {
  const liveChannels = new Set(
    twitchStreams.filter((s) => s.isLive).map((s) => s.faceitId)
  );

  const playing = friends.filter((f) => f.isPlaying);
  const offline = friends.filter((f) => !f.isPlaying);

  return (
    <aside className="w-[260px] bg-bg-card border-r border-border p-3 overflow-y-auto flex-shrink-0">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          {playing.length > 0 && (
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          )}
          <span className="text-[11px] text-accent uppercase tracking-wider">
            Playing ({playing.length})
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {playing.map((friend) => (
          <FriendCard
            key={friend.faceitId}
            friend={friend}
            isSelected={selectedFriendId === friend.faceitId}
            isLive={liveChannels.has(friend.faceitId)}
            onClick={() => onSelectFriend(friend.faceitId)}
          />
        ))}
      </div>

      {offline.length > 0 && (
        <>
          <div className="text-[10px] text-text-dim uppercase tracking-wider mt-4 mb-2">
            Offline ({offline.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {offline.map((friend) => (
              <FriendCard
                key={friend.faceitId}
                friend={friend}
                isSelected={selectedFriendId === friend.faceitId}
                isLive={liveChannels.has(friend.faceitId)}
                onClick={() => onSelectFriend(friend.faceitId)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/StreakBar.tsx src/components/MapBadge.tsx src/components/FriendCard.tsx src/components/FriendsSidebar.tsx
git commit -m "feat: add friend sidebar components with stat cards and streak bars"
```

---

## Task 10: Dashboard — Main Area Components

**Files:**
- Create: `src/components/TwitchEmbed.tsx`, `src/components/LiveMatchCard.tsx`, `src/components/MatchRow.tsx`, `src/components/RecentMatches.tsx`

- [ ] **Step 1: Create TwitchEmbed**

`src/components/TwitchEmbed.tsx`:
```tsx
import type { TwitchStream } from "~/lib/types";

interface TwitchEmbedProps {
  stream: TwitchStream;
}

export function TwitchEmbed({ stream }: TwitchEmbedProps) {
  return (
    <div className="bg-[#18181b] border border-twitch/30 rounded-lg overflow-hidden mb-4">
      <div className="flex justify-between items-center px-3 py-2 bg-[#0e0e10]">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span className="text-text text-sm font-bold">{stream.channel}</span>
          <span className="text-[9px] text-error bg-error/20 px-1.5 py-0.5 rounded">LIVE</span>
          <span className="text-text-muted text-xs">· {stream.viewerCount.toLocaleString()} viewers</span>
        </div>
        <a
          href={`https://twitch.tv/${stream.channel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-twitch text-xs hover:underline"
        >
          Open on Twitch
        </a>
      </div>
      <iframe
        src={`https://player.twitch.tv/?channel=${stream.channel}&parent=${typeof window !== "undefined" ? window.location.hostname : "localhost"}`}
        height="300"
        width="100%"
        allowFullScreen
        className="border-0"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create LiveMatchCard**

`src/components/LiveMatchCard.tsx`:
```tsx
import type { LiveMatch } from "~/lib/types";
import { MapBadge } from "./MapBadge";
import { TRACKED_FRIENDS } from "~/lib/constants";

interface LiveMatchCardProps {
  match: LiveMatch;
}

export function LiveMatchCard({ match }: LiveMatchCardProps) {
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const isFriendFaction1 = match.friendFaction === "faction1";

  return (
    <div className="bg-gradient-to-br from-accent/5 to-bg-card border border-accent/20 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-error text-xs">
            <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
            LIVE
          </span>
          <MapBadge map={match.map} />
        </div>
        <span className="text-text-muted text-xs">{match.status}</span>
      </div>

      <div className="flex justify-center items-center gap-6 mb-3">
        <div className="text-center">
          <div className={`text-sm mb-1 ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f1.name}
          </div>
          <div className={`text-3xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction1}
          </div>
        </div>
        <div className="text-text-dim text-lg">vs</div>
        <div className="text-center">
          <div className={`text-sm mb-1 ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f2.name}
          </div>
          <div className={`text-3xl font-bold ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction2}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5">
        {match.friendIds.map((id) => {
          const roster = [...f1.roster, ...f2.roster];
          const player = roster.find((p) => p.playerId === id);
          return (
            <span
              key={id}
              className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded"
            >
              {player?.nickname || id.slice(0, 8)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create MatchRow and RecentMatches**

`src/components/MatchRow.tsx`:
```tsx
import { MapBadge } from "./MapBadge";

interface MatchRowProps {
  nickname: string;
  map: string;
  score: string;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  win: boolean;
  eloDelta?: number | null;
}

export function MatchRow({ nickname, map, score, kdRatio, adr, hsPercent, win, eloDelta }: MatchRowProps) {
  return (
    <div
      className={`flex items-center bg-bg-card rounded px-2.5 py-2 text-xs border-l-[3px] ${
        win ? "border-accent" : "border-error"
      }`}
    >
      <span className={`font-bold w-5 ${win ? "text-accent" : "text-error"}`}>
        {win ? "W" : "L"}
      </span>
      <span className="text-text w-20 truncate">{nickname}</span>
      <span className="w-20"><MapBadge map={map} /></span>
      <span className="text-text-muted w-14">{score}</span>
      <span className="text-text-muted flex-1">
        K/D {kdRatio.toFixed(1)} · ADR {adr.toFixed(0)} · HS {hsPercent}%
      </span>
      {eloDelta != null && (
        <span className={`${eloDelta >= 0 ? "text-accent" : "text-error"}`}>
          {eloDelta >= 0 ? "+" : ""}{eloDelta}
        </span>
      )}
    </div>
  );
}
```

`src/components/RecentMatches.tsx`:
```tsx
import { MatchRow } from "./MatchRow";

interface RecentMatch {
  nickname: string;
  matchId: string;
  map: string;
  score: string;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  result: boolean;
  eloDelta?: number | null;
}

interface RecentMatchesProps {
  matches: RecentMatch[];
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  if (!matches.length) {
    return (
      <div className="text-text-dim text-sm text-center py-8">
        No recent matches
      </div>
    );
  }

  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">
        Recent Matches
      </div>
      <div className="flex flex-col gap-1">
        {matches.map((m) => (
          <MatchRow key={m.matchId + m.nickname} {...m} win={m.result} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TwitchEmbed.tsx src/components/LiveMatchCard.tsx src/components/MatchRow.tsx src/components/RecentMatches.tsx
git commit -m "feat: add main area components — Twitch embed, live match card, recent matches"
```

---

## Task 11: Dashboard Page — Wire Everything Together

**Files:**
- Create: `src/routes/_authed/dashboard.tsx`

- [ ] **Step 1: Create the dashboard route**

`src/routes/_authed/dashboard.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFriends } from "~/hooks/useFriends";
import { useLiveMatches } from "~/hooks/useLiveMatches";
import { useTwitchLive } from "~/hooks/useTwitchLive";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { FriendsSidebar } from "~/components/FriendsSidebar";
import { TwitchEmbed } from "~/components/TwitchEmbed";
import { LiveMatchCard } from "~/components/LiveMatchCard";
import { RecentMatches } from "~/components/RecentMatches";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const { data: friends = [], isLoading: friendsLoading, isError: friendsError } = useFriends();
  const { data: liveMatches = [] } = useLiveMatches();
  const { data: twitchStreams = [] } = useTwitchLive();
  const { data: playerStats = [] } = usePlayerStats(selectedFriendId);

  // Mark friends as playing based on live matches
  const playingFriendIds = new Set(liveMatches.flatMap((m) => m.friendIds));
  const enrichedFriends = friends.map((f) => ({
    ...f,
    isPlaying: playingFriendIds.has(f.faceitId),
    currentMatchId: liveMatches.find((m) => m.friendIds.includes(f.faceitId))?.matchId ?? null,
  }));

  // Find first live Twitch stream
  const liveStream = twitchStreams.find((s) => s.isLive);

  // Build recent matches from player stats
  const recentMatches = playerStats.slice(0, 10).map((m: any) => ({
    nickname: m.nickname,
    matchId: m.matchId,
    map: m.map,
    score: m.score,
    kdRatio: m.kdRatio,
    adr: m.adr,
    hsPercent: m.hsPercent,
    result: m.result,
    eloDelta: null,
  }));

  if (friendsLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-accent animate-pulse">Loading friends...</div>
      </div>
    );
  }

  if (friendsError) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-error">Failed to load friends. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
        <FriendsSidebar
          friends={enrichedFriends}
          twitchStreams={twitchStreams}
          selectedFriendId={selectedFriendId}
          onSelectFriend={setSelectedFriendId}
        />

        <main className="flex-1 p-4 overflow-y-auto">
          {/* Twitch Embed */}
          {liveStream && <TwitchEmbed stream={liveStream} />}

          {/* Live Matches */}
          {liveMatches.map((match) => (
            <LiveMatchCard key={match.matchId} match={match} />
          ))}

          {/* Recent Matches */}
          {selectedFriendId ? (
            <RecentMatches matches={recentMatches} />
          ) : (
            <div className="text-text-dim text-sm text-center py-12">
              Select a friend to view their match history
            </div>
          )}
        </main>
    </div>
  );
}
```

> **Note:** `QueryClientProvider` is set up in `__root.tsx`. TanStack Start may have a built-in integration — check docs for `routerWithQueryClient` or similar pattern.

- [ ] **Step 2: Verify the dashboard renders**

```bash
npm run dev
```

Log in, navigate to `/dashboard`. Should see:
- Left sidebar with friend cards (loading, then populated)
- Main area with Twitch embed (if anyone is live) and live match cards

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authed/dashboard.tsx
git commit -m "feat: wire up dashboard page with all components and polling"
```

---

## Task 12: History Page + Leaderboard Stub

**Files:**
- Create: `src/routes/_authed/history.tsx`
- Create: `src/routes/_authed/leaderboard.tsx`

- [ ] **Step 1: Create history page**

`src/routes/_authed/history.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFriends } from "~/hooks/useFriends";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { RecentMatches } from "~/components/RecentMatches";

export const Route = createFileRoute("/_authed/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data: friends = [] } = useFriends();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: stats = [], isLoading } = usePlayerStats(selectedId);

  const matches = stats.map((m: any) => ({
    nickname: m.nickname,
    matchId: m.matchId,
    map: m.map,
    score: m.score,
    kdRatio: m.kdRatio,
    adr: m.adr,
    hsPercent: m.hsPercent,
    result: m.result,
    eloDelta: null,
  }));

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Match History</h2>

        <div className="flex gap-2 flex-wrap mb-6">
          {friends.map((f) => (
            <button
              key={f.faceitId}
              onClick={() => setSelectedId(f.faceitId)}
              className={`text-xs px-3 py-1.5 rounded ${
                selectedId === f.faceitId
                  ? "bg-accent text-bg font-bold"
                  : "bg-bg-elevated text-text-muted hover:text-accent"
              }`}
            >
              {f.nickname}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-accent animate-pulse text-center py-8">Loading...</div>
        ) : selectedId ? (
          <RecentMatches matches={matches} />
        ) : (
          <div className="text-text-dim text-center py-12">Select a friend to view history</div>
        )}
    </div>
  );
}
```

- [ ] **Step 2: Create leaderboard stub**

`src/routes/_authed/leaderboard.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-accent text-2xl font-bold">Leaderboard</h1>
      <p className="text-text-muted">Coming in Phase 2 — Betting System</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authed/history.tsx src/routes/_authed/leaderboard.tsx
git commit -m "feat: add history page and leaderboard stub"
```

---

## Task 13: End-to-End Verification + Deploy

**Files:** None new — testing and deployment.

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run dev server and verify end-to-end**

```bash
npm run dev
```

Use Playwright MCP to verify:
1. Login page loads at `/`
2. Sign up with test email
3. Dashboard loads at `/dashboard`
4. Friends appear in sidebar after loading
5. Twitch embed shows if a stream is live
6. History page works at `/history`

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Deploy to Vercel**

Use Vercel MCP to:
1. Create project `faceit-match`
2. Set environment variables (FACEIT_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Deploy

```bash
vercel deploy
```

- [ ] **Step 5: Verify production deployment**

Use Playwright MCP to visit the Vercel deployment URL and verify the dashboard works.

- [ ] **Step 6: Final commit + tag**

```bash
git add -A
git commit -m "chore: production build and deployment config"
git tag v0.1.0-mvp
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project scaffolding | 12 |
| 2 | Constants, types, tests | 7 |
| 3 | Supabase setup + schema | 7 |
| 4 | FACEIT API client + tests | 5 |
| 5 | Twitch API client + tests | 5 |
| 6 | API routes (5 endpoints) | 7 |
| 7 | TanStack Query hooks | 5 |
| 8 | Auth (login + guard) | 5 |
| 9 | Sidebar components | 5 |
| 10 | Main area components | 4 |
| 11 | Dashboard page assembly | 3 |
| 12 | History + leaderboard stub | 3 |
| 13 | E2E verification + deploy | 6 |
| **Total** | | **74 steps** |
