# Bet Failed Events — Design Spec

**Date:** 2026-04-10
**Goal:** Log failed `place_bet` attempts to a DB table for debugging (e.g. understanding what error a specific user got on a specific match).

---

## Problem

`bet_audit_events` only records successful bets. Failed attempts leave no trace. When a user reports an error placing a bet, there is no way to verify what happened at the DB level.

## Solution

A new `bet_failed_events` table, populated from inside the `place_bet` PostgreSQL function before every error return. No app-layer changes required — pure DB migration.

---

## Table: `bet_failed_events`

```sql
CREATE TABLE bet_failed_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id                   UUID REFERENCES betting_pools(id) ON DELETE SET NULL,
  faceit_match_id           TEXT,
  side                      TEXT,
  amount                    INTEGER,
  error_reason              TEXT NOT NULL,
  pool_status               TEXT,
  pool_closes_at            TIMESTAMPTZ,
  match_started_at          TIMESTAMPTZ,
  seconds_since_match_start INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bet_failed_events_user_id
  ON bet_failed_events(user_id, created_at DESC);

CREATE INDEX idx_bet_failed_events_match_id
  ON bet_failed_events(faceit_match_id, created_at DESC);
```

No RLS — accessed via Supabase dashboard only.

### Nullable columns

Columns are nullable because context availability depends on where in `place_bet` the error occurs:

| Column | Nullable when |
|--------|--------------|
| `pool_id` | Error occurs before pool lookup (e.g. season not found, invalid side) |
| `faceit_match_id` | Same |
| `side` | Same |
| `pool_status` | Same |
| `pool_closes_at` | Same |
| `match_started_at` | Same |
| `seconds_since_match_start` | Match not started yet, or early error |
| `amount` | Never — always an input param |

---

## Changes to `place_bet`

Migration `013_bet_failed_events.sql` adds the table and replaces `place_bet` with an updated version that inserts into `bet_failed_events` before each error return.

### Error points covered

| Error reason | Context available |
|---|---|
| `'Provide exactly one of pool_id or prop_pool_id'` | user_id, side, amount only |
| `'Season not found'` | user_id, side, amount only |
| `'Season is not active'` | user_id, side, amount only |
| `'Not enough coins'` | user_id, side, amount only |
| `'Invalid side for match bet'` | user_id, side, amount only |
| `'Pool not found'` | user_id, side, amount only |
| `'Betting is closed'` | full pool context |
| `'Already placed a bet on this match'` | full pool context |
| `'Invalid side for prop bet'` | user_id, side, amount; pool_id NULL |
| `'Prop pool not found'` | user_id, side, amount; pool_id NULL |

### Insert pattern (before each error return)

```sql
INSERT INTO bet_failed_events (
  user_id, pool_id, faceit_match_id, side, amount,
  error_reason, pool_status, pool_closes_at,
  match_started_at, seconds_since_match_start
) VALUES (
  p_user_id,
  v_pool.id,          -- NULL if pool not yet loaded
  v_pool.faceit_match_id,
  p_side,
  p_amount,
  '<error_reason>',
  v_pool.status,
  v_pool.closes_at,
  v_pool.match_started_at,
  v_seconds_since_match_start
);
RETURN json_build_object('error', '<error_reason>');
```

---

## Deliverable

Single migration: `supabase/migrations/013_bet_failed_events.sql`

- Creates `bet_failed_events` table + indexes
- Replaces `place_bet` with updated version logging all failures
