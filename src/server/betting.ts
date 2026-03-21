import { createServerFn } from "@tanstack/react-start";
import { createServerSupabase } from "~/lib/supabase.server";
import type { BettingPool, Bet, BetWithPool, LeaderboardEntry } from "~/lib/types";

// ── Helpers ──────────────────────────────────────────────────
// Note: server functions use the service role key (createServerSupabase).
// auth.uid() is NULL server-side. userId is passed explicitly from the client
// and verified at the DB level via UNIQUE constraints + RPC logic.
// For a 5-15 person friend group this is acceptable; a production system
// would extract userId from the request JWT via the auth.admin API.

function rowToPool(r: any): BettingPool {
  return {
    id: r.id,
    faceitMatchId: r.faceit_match_id,
    status: r.status,
    team1Name: r.team1_name,
    team2Name: r.team2_name,
    team1Pool: r.team1_pool,
    team2Pool: r.team2_pool,
    winningTeam: r.winning_team,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    resolvedAt: r.resolved_at,
  };
}

// ── createBettingPool ─────────────────────────────────────────

export const createBettingPool = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      faceitMatchId: string;
      team1Name: string;
      team2Name: string;
      startedAt: number; // unix seconds
    }) => input
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabase();
    const opensAt = new Date(data.startedAt * 1000).toISOString();
    const closesAt = new Date(data.startedAt * 1000 + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from("betting_pools").insert({
      faceit_match_id: data.faceitMatchId,
      team1_name: data.team1Name,
      team2_name: data.team2Name,
      opens_at: opensAt,
      closes_at: closesAt,
    });
    // Conflict (already exists) is silently ignored
    if (error && !error.message.includes("duplicate")) {
      console.error("createBettingPool error:", error.message);
    }
    return { ok: true };
  });

// ── getBettingPool ────────────────────────────────────────────

export const getBettingPool = createServerFn({ method: "GET" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }): Promise<{
    pool: BettingPool | null;
    userBet: Bet | null;
    userCoins: number;
  }> => {
    const supabase = createServerSupabase();

    const { data: poolRow } = await supabase
      .from("betting_pools")
      .select("*")
      .eq("faceit_match_id", faceitMatchId)
      .single();

    if (!poolRow) return { pool: null, userBet: null, userCoins: 0 };

    // Get user's bet if any — need user id from session (client-side context)
    // userBet fetched client-side via useBettingPool hook
    return { pool: rowToPool(poolRow), userBet: null, userCoins: 0 };
  });

// ── placeBet ──────────────────────────────────────────────────

export const placeBet = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { poolId: string; side: "team1" | "team2"; amount: number; userId: string }) =>
      input
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const supabase = createServerSupabase();
    const { data: result, error } = await supabase.rpc("place_bet", {
      p_user_id: data.userId,
      p_pool_id: data.poolId,
      p_side: data.side,
      p_amount: data.amount,
    });
    if (error) return { success: false, error: error.message };
    const parsed = result as any;
    if (parsed?.error) return { success: false, error: parsed.error };
    return { success: true };
  });

// ── resolvePool ───────────────────────────────────────────────

export const resolvePool = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { faceitMatchId: string; winningTeam: "team1" | "team2" }) => input
  )
  .handler(async ({ data }) => {
    const supabase = createServerSupabase();
    await supabase.rpc("resolve_pool", {
      p_faceit_match_id: data.faceitMatchId,
      p_winning_team: data.winningTeam,
    });
    return { ok: true };
  });

// ── cancelPool ────────────────────────────────────────────────

export const cancelPool = createServerFn({ method: "POST" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }) => {
    const supabase = createServerSupabase();
    await supabase.rpc("cancel_pool", { p_faceit_match_id: faceitMatchId });
    return { ok: true };
  });

// ── claimDailyAllowance ───────────────────────────────────────
// Note: resolveStalePools logic lives inline in getLiveMatches (src/server/matches.ts)
// to avoid an extra server function call on each poll. No standalone export needed.

export const claimDailyAllowance = createServerFn({ method: "POST" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<number> => {
    const supabase = createServerSupabase();
    const { data } = await supabase.rpc("claim_daily_allowance", {
      p_user_id: userId,
    });
    return (data as any)?.coins ?? 0;
  });

// ── getLeaderboard ────────────────────────────────────────────

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardEntry[]> => {
    const supabase = createServerSupabase();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, coins")
      .order("coins", { ascending: false });

    if (!profiles) return [];

    // Enrich with bet counts
    const { data: betCounts } = await supabase
      .from("bets")
      .select("user_id, amount, payout");

    const countMap = new Map<string, { placed: number; won: number }>();
    for (const b of betCounts ?? []) {
      const curr = countMap.get(b.user_id) ?? { placed: 0, won: 0 };
      curr.placed++;
      if (b.payout !== null && b.payout > b.amount) curr.won++;
      countMap.set(b.user_id, curr);
    }

    return profiles.map((p) => {
      const counts = countMap.get(p.id) ?? { placed: 0, won: 0 };
      return {
        userId: p.id,
        nickname: p.nickname,
        coins: p.coins,
        betsPlaced: counts.placed,
        betsWon: counts.won,
      };
    });
  }
);

// ── getUserBetHistory ─────────────────────────────────────────

export const getUserBetHistory = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<BetWithPool[]> => {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("bets")
      .select("*, betting_pools(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row: any) => ({
      id: row.id,
      poolId: row.pool_id,
      userId: row.user_id,
      side: row.side,
      amount: row.amount,
      payout: row.payout,
      createdAt: row.created_at,
      pool: rowToPool(row.betting_pools),
    }));
  });
