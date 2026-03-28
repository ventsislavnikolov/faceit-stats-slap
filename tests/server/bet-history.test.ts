import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.20/node_modules/@tanstack/start-storage-context/dist/esm/index.js";

const supabaseMocks = vi.hoisted(() => {
  let bets: any[] | null = [];
  let auditEvents: any[] | null = [];

  const betsEqUserId = vi.fn(() => ({
    order: vi.fn(async () => ({ data: bets })),
  }));
  const betsSelect = vi.fn(() => ({
    eq: betsEqUserId,
  }));

  const auditInBetIds = vi.fn(async (_column: string, ids: string[]) => ({
    data: (auditEvents ?? []).filter((row) => ids.includes(row.bet_id)),
  }));
  const auditEqMatchId = vi.fn((_: string, value: string) => ({
    order: vi.fn(async () => ({
      data: (auditEvents ?? []).filter((row) => row.faceit_match_id === value),
    })),
  }));
  const auditEqUserId = vi.fn((_: string, value: string) => ({
    order: vi.fn(async () => ({
      data: (auditEvents ?? []).filter((row) => row.user_id === value),
    })),
  }));
  const auditOrder = vi.fn(async () => ({ data: auditEvents }));
  const auditSelect = vi.fn(() => ({
    in: auditInBetIds,
    eq: (column: string, value: string) => {
      if (column === "faceit_match_id") {
        return auditEqMatchId(column, value);
      }
      if (column === "user_id") {
        return auditEqUserId(column, value);
      }
      throw new Error(`Unexpected eq on ${column}`);
    },
    order: auditOrder,
  }));

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "bets") {
          return {
            select: betsSelect,
          };
        }

        if (table === "bet_audit_events") {
          return {
            select: auditSelect,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
    setBets(value: any[] | null) {
      bets = value;
    },
    setAuditEvents(value: any[] | null) {
      auditEvents = value;
    },
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => supabaseMocks.supabase,
}));

import { getBetAuditLog, getUserBetHistory } from "~/server/betting";

afterEach(() => {
  vi.clearAllMocks();
  supabaseMocks.setBets([]);
  supabaseMocks.setAuditEvents([]);
});

describe("bet history audit metadata", () => {
  it("attaches match timing metadata to user bet history when audit rows exist", async () => {
    supabaseMocks.setBets([
      {
        id: "bet-1",
        pool_id: "pool-1",
        user_id: "user-1",
        side: "team1",
        amount: 100,
        payout: 180,
        created_at: "2026-03-24T12:01:00.000Z",
        betting_pools: {
          id: "pool-1",
          faceit_match_id: "match-1",
          status: "RESOLVED",
          team1_name: "Flawlesss",
          team2_name: "Opponents",
          team1_pool: 100,
          team2_pool: 100,
          winning_team: "team1",
          opens_at: "2026-03-24T12:00:00.000Z",
          closes_at: "2026-03-24T12:05:00.000Z",
          resolved_at: "2026-03-24T13:00:00.000Z",
        },
      },
    ]);
    supabaseMocks.setAuditEvents([
      {
        id: "audit-1",
        bet_id: "bet-1",
        pool_id: "pool-1",
        faceit_match_id: "match-1",
        user_id: "user-1",
        side: "team1",
        amount: 100,
        bet_created_at: "2026-03-24T12:01:00.000Z",
        match_started_at: "2026-03-24T12:00:00.000Z",
        seconds_since_match_start: 60,
        captured_pool_status: "OPEN",
        created_at: "2026-03-24T12:01:00.000Z",
      },
    ]);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getUserBetHistory({ data: "user-1" })
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "bet-1",
        audit: expect.objectContaining({
          betId: "bet-1",
          secondsSinceMatchStart: 60,
          matchStartedAt: "2026-03-24T12:00:00.000Z",
        }),
      }),
    ]);
  });

  it("returns developer audit rows filtered by match id", async () => {
    supabaseMocks.setAuditEvents([
      {
        id: "audit-1",
        bet_id: "bet-1",
        pool_id: "pool-1",
        faceit_match_id: "match-1",
        user_id: "user-1",
        side: "team1",
        amount: 100,
        bet_created_at: "2026-03-24T12:01:00.000Z",
        match_started_at: "2026-03-24T12:00:00.000Z",
        seconds_since_match_start: 60,
        captured_pool_status: "OPEN",
        created_at: "2026-03-24T12:01:00.000Z",
      },
      {
        id: "audit-2",
        bet_id: "bet-2",
        pool_id: "pool-2",
        faceit_match_id: "match-2",
        user_id: "user-2",
        side: "team2",
        amount: 50,
        bet_created_at: "2026-03-24T12:02:00.000Z",
        match_started_at: "2026-03-24T12:00:00.000Z",
        seconds_since_match_start: 120,
        captured_pool_status: "OPEN",
        created_at: "2026-03-24T12:02:00.000Z",
      },
    ]);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getBetAuditLog({ data: { faceitMatchId: "match-1" } })
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "audit-1",
        faceitMatchId: "match-1",
        secondsSinceMatchStart: 60,
      }),
    ]);
  });
});
