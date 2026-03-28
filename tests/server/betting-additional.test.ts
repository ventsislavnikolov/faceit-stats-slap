import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.20/node_modules/@tanstack/start-storage-context/dist/esm/index.js";

// Flexible chainable mock supabase
const mocks = vi.hoisted(() => {
  let responseQueue: Array<{ data: unknown; error: unknown }> = [];
  let rpcResponse: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  };

  const makeChain = () => {
    const chain: Record<string, any> = {};
    for (const method of ["select", "eq", "in", "order", "insert"]) {
      chain[method] = vi.fn((..._args: unknown[]) => {
        if (method === "insert" || method === "order") {
          return Promise.resolve(
            responseQueue.shift() ?? { data: null, error: null }
          );
        }
        return chain;
      });
    }
    chain.single = vi.fn(() =>
      Promise.resolve(responseQueue.shift() ?? { data: null, error: null })
    );
    // Make chain thenable so `await supabase.from(...).select(...).in(...)` works
    // biome-ignore lint/suspicious/noThenProperty: required for Supabase query chain mock
    chain.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown
    ) =>
      Promise.resolve(
        responseQueue.shift() ?? { data: null, error: null }
      ).then(resolve, reject);
    return chain;
  };

  const chain = makeChain();

  return {
    supabase: {
      from: vi.fn((_table: string) => chain),
      rpc: vi.fn(async () => rpcResponse),
    },
    chain,
    pushResponse(data: unknown, error: unknown = null) {
      responseQueue.push({ data, error });
    },
    setRpcResponse(data: unknown, error: unknown = null) {
      rpcResponse = { data, error };
    },
    reset() {
      responseQueue = [];
      rpcResponse = { data: null, error: null };
    },
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => mocks.supabase,
}));

import {
  cancelPool,
  createBettingPool,
  getBetAuditLog,
  getBettingPool,
  getCoinBalance,
  getUserBetForMatch,
  getUserBetHistory,
  placeBet,
  resolvePool,
} from "~/server/betting";

const startCtx = {
  contextAfterGlobalMiddlewares: {},
  request: new Request("http://localhost"),
} as any;

function run<T>(fn: () => Promise<T>): Promise<T> {
  return runWithStartContext(startCtx, fn) as Promise<T>;
}

afterEach(() => {
  vi.clearAllMocks();
  mocks.reset();
});

// ── createBettingPool ─────────────────────────────────────────

describe("createBettingPool", () => {
  const input = {
    faceitMatchId: "match-1",
    team1Name: "Alpha",
    team2Name: "Bravo",
    startedAt: 1_700_000_000,
  };

  it("inserts correct data and returns ok", async () => {
    mocks.pushResponse(null, null);
    const result = await run(() => createBettingPool({ data: input } as any));
    expect(result).toEqual({ ok: true });
    expect(mocks.supabase.from).toHaveBeenCalledWith("betting_pools");
    expect(mocks.chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        faceit_match_id: "match-1",
        team1_name: "Alpha",
        team2_name: "Bravo",
      })
    );
  });

  it("silently ignores conflict error (23505)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.pushResponse(null, { code: "23505", message: "duplicate" });
    const result = await run(() => createBettingPool({ data: input } as any));
    expect(result).toEqual({ ok: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs non-conflict errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.pushResponse(null, { code: "42000", message: "something broke" });
    const result = await run(() => createBettingPool({ data: input } as any));
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith(
      "createBettingPool error:",
      "something broke"
    );
    spy.mockRestore();
  });
});

// ── getBettingPool ────────────────────────────────────────────

describe("getBettingPool", () => {
  it("returns pool when found", async () => {
    mocks.pushResponse({
      id: "pool-1",
      faceit_match_id: "match-1",
      status: "OPEN",
      team1_name: "A",
      team2_name: "B",
      team1_pool: 100,
      team2_pool: 200,
      winning_team: null,
      opens_at: "2024-01-01T00:00:00Z",
      closes_at: "2024-01-01T00:05:00Z",
      resolved_at: null,
    });

    const result = await run(() => getBettingPool({ data: "match-1" } as any));
    expect(result.pool).toEqual(
      expect.objectContaining({
        id: "pool-1",
        faceitMatchId: "match-1",
        status: "OPEN",
        team1Name: "A",
        team2Name: "B",
      })
    );
    expect(result.userBet).toBeNull();
  });

  it("returns null pool when not found", async () => {
    mocks.pushResponse(null);
    const result = await run(() => getBettingPool({ data: "no-match" } as any));
    expect(result).toEqual({ pool: null, userBet: null, userCoins: 0 });
  });
});

// ── placeBet ──────────────────────────────────────────────────

describe("placeBet", () => {
  const input = {
    seasonId: "season-1",
    poolId: "pool-1",
    side: "team1" as const,
    amount: 50,
    userId: "user-1",
  };

  it("returns success on happy path", async () => {
    mocks.setRpcResponse({ ok: true });
    const result = await run(() => placeBet({ data: input } as any));
    expect(result).toEqual({ success: true });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("place_bet", {
      p_user_id: "user-1",
      p_season_id: "season-1",
      p_pool_id: "pool-1",
      p_prop_pool_id: null,
      p_side: "team1",
      p_amount: 50,
    });
  });

  it("returns error from rpc failure", async () => {
    mocks.setRpcResponse(null, { message: "pool closed" });
    const result = await run(() => placeBet({ data: input } as any));
    expect(result).toEqual({ success: false, error: "pool closed" });
  });

  it("returns parsed error from result", async () => {
    mocks.setRpcResponse({ error: "insufficient coins" });
    const result = await run(() => placeBet({ data: input } as any));
    expect(result).toEqual({ success: false, error: "insufficient coins" });
  });
});

// ── resolvePool ───────────────────────────────────────────────

describe("resolvePool", () => {
  it("calls rpc with correct args and returns ok", async () => {
    mocks.setRpcResponse(null);
    const result = await run(() =>
      resolvePool({
        data: { faceitMatchId: "match-1", winningTeam: "team2" },
      } as any)
    );
    expect(result).toEqual({ ok: true });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("resolve_pool", {
      p_faceit_match_id: "match-1",
      p_winning_team: "team2",
    });
  });
});

// ── cancelPool ────────────────────────────────────────────────

describe("cancelPool", () => {
  it("calls rpc and returns ok", async () => {
    mocks.setRpcResponse(null);
    const result = await run(() => cancelPool({ data: "match-1" } as any));
    expect(result).toEqual({ ok: true });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("cancel_pool", {
      p_faceit_match_id: "match-1",
    });
  });
});

// ── getCoinBalance ────────────────────────────────────────────

describe("getCoinBalance", () => {
  it("returns coins from profile", async () => {
    mocks.pushResponse({ coins: 750 });
    const result = await run(() => getCoinBalance({ data: "user-1" } as any));
    expect(result).toBe(750);
  });

  it("returns 0 when no profile", async () => {
    mocks.pushResponse(null);
    const result = await run(() => getCoinBalance({ data: "ghost" } as any));
    expect(result).toBe(0);
  });
});

// ── getUserBetForMatch ────────────────────────────────────────

describe("getUserBetForMatch", () => {
  it("returns bet when found", async () => {
    mocks.pushResponse({ id: "pool-1" });
    mocks.pushResponse({
      id: "bet-1",
      pool_id: "pool-1",
      user_id: "user-1",
      side: "team1",
      amount: 100,
      payout: null,
      created_at: "2024-01-01T00:00:00Z",
    });

    const result = await run(() =>
      getUserBetForMatch({
        data: { faceitMatchId: "match-1", userId: "user-1" },
      } as any)
    );
    expect(result).toEqual({
      id: "bet-1",
      poolId: "pool-1",
      userId: "user-1",
      side: "team1",
      amount: 100,
      payout: null,
      createdAt: "2024-01-01T00:00:00Z",
    });
  });

  it("returns null when no pool exists", async () => {
    mocks.pushResponse(null);
    const result = await run(() =>
      getUserBetForMatch({
        data: { faceitMatchId: "no-match", userId: "user-1" },
      } as any)
    );
    expect(result).toBeNull();
  });

  it("returns null when no bet exists for user", async () => {
    mocks.pushResponse({ id: "pool-1" });
    mocks.pushResponse(null);
    const result = await run(() =>
      getUserBetForMatch({
        data: { faceitMatchId: "match-1", userId: "user-2" },
      } as any)
    );
    expect(result).toBeNull();
  });
});

// ── getUserBetHistory ─────────────────────────────────────────

describe("getUserBetHistory", () => {
  it("returns mapped bets with audit events", async () => {
    // First response: bets query (order is terminal)
    mocks.pushResponse([
      {
        id: "bet-1",
        pool_id: "pool-1",
        user_id: "user-1",
        side: "team1",
        amount: 50,
        payout: 100,
        created_at: "2024-01-01T00:00:00Z",
        betting_pools: {
          id: "pool-1",
          faceit_match_id: "match-1",
          status: "RESOLVED",
          team1_name: "A",
          team2_name: "B",
          team1_pool: 300,
          team2_pool: 200,
          winning_team: "team1",
          opens_at: "2024-01-01T00:00:00Z",
          closes_at: "2024-01-01T00:05:00Z",
          resolved_at: "2024-01-01T00:30:00Z",
        },
      },
    ]);

    // Second response: audit events (in query)
    mocks.pushResponse([
      {
        id: "audit-1",
        bet_id: "bet-1",
        pool_id: "pool-1",
        faceit_match_id: "match-1",
        user_id: "user-1",
        side: "team1",
        amount: 50,
        bet_created_at: "2024-01-01T00:00:00Z",
        match_started_at: "2024-01-01T00:00:00Z",
        seconds_since_match_start: 30,
        captured_pool_status: "OPEN",
        created_at: "2024-01-01T00:00:01Z",
      },
    ]);

    const result = await run(() =>
      getUserBetHistory({ data: "user-1" } as any)
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bet-1");
    expect(result[0].pool.faceitMatchId).toBe("match-1");
    expect(result[0].audit).toEqual(
      expect.objectContaining({
        id: "audit-1",
        betId: "bet-1",
        secondsSinceMatchStart: 30,
      })
    );
  });

  it("returns empty array when no bets", async () => {
    mocks.pushResponse([]);
    const result = await run(() =>
      getUserBetHistory({ data: "user-1" } as any)
    );
    expect(result).toEqual([]);
  });
});

// ── getBetAuditLog ────────────────────────────────────────────

describe("getBetAuditLog", () => {
  const auditRow = {
    id: "audit-1",
    bet_id: "bet-1",
    pool_id: "pool-1",
    faceit_match_id: "match-1",
    user_id: "user-1",
    side: "team1",
    amount: 50,
    bet_created_at: "2024-01-01T00:00:00Z",
    match_started_at: null,
    seconds_since_match_start: null,
    captured_pool_status: "OPEN",
    created_at: "2024-01-01T00:00:01Z",
  };

  it("filters by faceitMatchId", async () => {
    mocks.pushResponse([auditRow]);
    const result = await run(() =>
      getBetAuditLog({ data: { faceitMatchId: "match-1" } } as any)
    );
    expect(result).toHaveLength(1);
    expect(result[0].faceitMatchId).toBe("match-1");
    expect(mocks.chain.eq).toHaveBeenCalledWith("faceit_match_id", "match-1");
  });

  it("filters by userId when no faceitMatchId", async () => {
    mocks.pushResponse([auditRow]);
    await run(() => getBetAuditLog({ data: { userId: "user-1" } } as any));
    expect(mocks.chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("respects limit parameter", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      ...auditRow,
      id: `audit-${i}`,
    }));
    mocks.pushResponse(rows);
    const result = await run(() =>
      getBetAuditLog({ data: { limit: 2 } } as any)
    );
    expect(result).toHaveLength(2);
  });

  it("clamps limit to valid range", async () => {
    mocks.pushResponse([]);
    await run(() => getBetAuditLog({ data: { limit: 0 } } as any));
    expect(mocks.chain.order).toHaveBeenCalled();
  });

  it("returns mapped audit events with null optional fields", async () => {
    mocks.pushResponse([auditRow]);
    const result = await run(() => getBetAuditLog({ data: {} } as any));
    expect(result[0].matchStartedAt).toBeNull();
    expect(result[0].secondsSinceMatchStart).toBeNull();
  });
});
