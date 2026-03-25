import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";

const supabaseMocks = vi.hoisted(() => {
  let profiles: Array<{ id: string; nickname: string; coins: number }> | null = [];
  let bets:
    | Array<{
        user_id: string;
        amount: number;
        payout: number | null;
        betting_pools: { status: string } | null;
      }>
    | null = [];

  const order = vi.fn(async () => ({ data: profiles }));
  const selectProfiles = vi.fn(() => ({ order }));
  const selectBets = vi.fn(async () => ({ data: bets }));

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: selectProfiles,
          };
        }

        if (table === "bets") {
          return {
            select: selectBets,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
    setProfiles(value: typeof profiles) {
      profiles = value;
    },
    setBets(value: typeof bets) {
      bets = value;
    },
    order,
    selectProfiles,
    selectBets,
  };
});

vi.mock("~/lib/supabase.server", () => ({
  createServerSupabase: () => supabaseMocks.supabase,
}));

import { getLeaderboard } from "~/server/betting";

afterEach(() => {
  vi.clearAllMocks();
  supabaseMocks.setProfiles([]);
  supabaseMocks.setBets([]);
});

describe("getLeaderboard", () => {
  it("returns profit-first aggregates and tie-breaks by coins", async () => {
    supabaseMocks.setProfiles([
      { id: "user-1", nickname: "alpha", coins: 900 },
      { id: "user-2", nickname: "bravo", coins: 1100 },
      { id: "user-3", nickname: "charlie", coins: 1500 },
    ]);
    supabaseMocks.setBets([
      {
        user_id: "user-1",
        amount: 100,
        payout: 120,
        betting_pools: { status: "RESOLVED" },
      },
      {
        user_id: "user-1",
        amount: 50,
        payout: 50,
        betting_pools: { status: "REFUNDED" },
      },
      {
        user_id: "user-2",
        amount: 80,
        payout: 140,
        betting_pools: { status: "RESOLVED" },
      },
      {
        user_id: "user-2",
        amount: 40,
        payout: null,
        betting_pools: { status: "OPEN" },
      },
      {
        user_id: "user-3",
        amount: 60,
        payout: 0,
        betting_pools: { status: "RESOLVED" },
      },
    ]);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLeaderboard(),
    );

    expect(result).toEqual([
      expect.objectContaining({
        userId: "user-2",
        nickname: "bravo",
        coins: 1100,
        betsPlaced: 2,
        betsWon: 1,
        resolvedBets: 1,
        totalWagered: 120,
        totalReturned: 140,
        netProfit: 20,
        winRate: 100,
      }),
      expect.objectContaining({
        userId: "user-1",
        nickname: "alpha",
        coins: 900,
        betsPlaced: 2,
        betsWon: 1,
        resolvedBets: 1,
        totalWagered: 150,
        totalReturned: 170,
        netProfit: 20,
        winRate: 100,
      }),
      expect.objectContaining({
        userId: "user-3",
        nickname: "charlie",
        coins: 1500,
        betsPlaced: 1,
        betsWon: 0,
        resolvedBets: 1,
        totalWagered: 60,
        totalReturned: 0,
        netProfit: -60,
        winRate: 0,
      }),
    ]);
  });

  it("returns zeroed aggregates when a profile has no bets", async () => {
    supabaseMocks.setProfiles([
      { id: "user-4", nickname: "delta", coins: 1000 },
    ]);
    supabaseMocks.setBets([]);

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => getLeaderboard(),
    );

    expect(result).toEqual([
      {
        userId: "user-4",
        nickname: "delta",
        coins: 1000,
        betsPlaced: 0,
        betsWon: 0,
        resolvedBets: 0,
        totalWagered: 0,
        totalReturned: 0,
        netProfit: 0,
        winRate: 0,
      },
    ]);
  });
});
