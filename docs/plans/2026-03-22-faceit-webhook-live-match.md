# FACEIT Webhook Live Match Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture live FACEIT `match_id` values for `soavarice`, `F1aw1esss`, and `TibaBG` via FACEIT webhooks and use that state to improve live match detection.

**Architecture:** Add a small authenticated POST route at `/api/faceit/webhook` that accepts FACEIT user webhook events, extracts `match_id` plus tracked player IDs, and persists active match state in Supabase. Update live match resolution to prefer webhook state before falling back to player history so the UI can see active matches earlier without inventing data.

**Tech Stack:** TanStack Start server routes, Supabase service-role client, FACEIT Webhooks, Vitest, SQL migrations.

---

### Task 1: Webhook parsing helpers

**Files:**
- Create: `src/lib/faceit-webhooks.ts`
- Create: `tests/lib/faceit-webhooks.test.ts`

**Step 1: Write the failing test**

Add parser tests for:
- extracting event name, `match_id`, and tracked player IDs from a payload with team rosters
- mapping active lifecycle events to active status
- mapping finished/cancelled/aborted lifecycle events to clearing behavior

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

**Step 3: Write minimal implementation**

Implement:
- tracked player ID constants for the three requested players
- tolerant payload extraction for `event`, `match_id`, and player IDs
- helpers to decide whether an event activates or clears live state

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

### Task 2: Persistence

**Files:**
- Create: `supabase/migrations/005_faceit_webhook_live_state.sql`
- Create: `src/server/faceit-webhooks.ts`
- Test: `tests/lib/faceit-webhooks.test.ts`

**Step 1: Write the failing test**

Add helper tests for grouping persisted webhook rows by `match_id` and player IDs.

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

**Step 3: Write minimal implementation**

Add a table for current webhook state keyed by `player_faceit_id`, storing `current_match_id`, `match_status`, `source_event`, raw payload, and timestamps. Add server helpers to upsert active state and clear rows by `match_id` and/or player IDs.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

### Task 3: Webhook route

**Files:**
- Create: `src/routes/api/faceit/webhook.tsx`
- Modify: `.env.example`

**Step 1: Write the failing test**

Prefer unit-testing auth and payload extraction helpers rather than route integration.

**Step 2: Write minimal implementation**

Implement a POST server route that:
- validates an optional configured header and/or query secret
- reads JSON body
- extracts webhook update info
- persists active/terminal state
- returns `204` for accepted events and `401` for bad auth

**Step 3: Verify manually**

Run local dev server and `curl` the endpoint with a sample payload.

### Task 4: Live match integration

**Files:**
- Modify: `src/server/matches.ts`
- Test: `tests/lib/faceit-webhooks.test.ts`

**Step 1: Write the failing test**

Add a helper-level test that webhook rows become `{ matchId -> friendIds[] }` before history fallback.

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

**Step 3: Write minimal implementation**

Update `getLiveMatches` to:
- query webhook state first for current player IDs
- seed `uniqueMatches` from webhook state
- skip history lookups for players already covered by webhook state
- keep current match-details/stat behavior unchanged once `match_id` is known

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

### Task 5: Verify and document setup

**Files:**
- Modify: `.env.example`

**Step 1: Run targeted tests**

Run: `pnpm test tests/lib/faceit-webhooks.test.ts`

**Step 2: Run full verification**

Run:
- `pnpm test`
- `pnpm build`

**Step 3: Provide FACEIT dashboard setup**

Document:
- callback URL
- recommended auth header/query secret config
- tracked user IDs to subscribe
- user events to enable: `match_object_created`, `match_status_configuring`, `match_status_ready`, `match_status_finished`, `match_status_cancelled`, `match_status_aborted`
