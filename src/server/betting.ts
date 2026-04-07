import { createServerFn } from "@tanstack/react-start";
import { createServerSupabase } from "~/lib/supabase.server";
import type {
  Bet,
  BetAuditEvent,
  BetHistoryItem,
  BettingPool,
  PropPool,
} from "~/lib/types";

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

function rowToPropPool(row: any): PropPool {
  return {
    id: row.id,
    seasonId: row.season_id,
    faceitMatchId: row.faceit_match_id,
    playerId: row.player_id,
    playerNickname: row.player_nickname,
    statKey: row.stat_key,
    threshold: Number(row.threshold),
    description: row.description,
    yesPool: row.yes_pool,
    noPool: row.no_pool,
    outcome: row.outcome,
    status: row.status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function rowToBetAuditEvent(row: any): BetAuditEvent {
  return {
    id: row.id,
    betId: row.bet_id,
    poolId: row.pool_id,
    faceitMatchId: row.faceit_match_id,
    userId: row.user_id,
    side: row.side,
    amount: row.amount,
    betCreatedAt: row.bet_created_at,
    matchStartedAt: row.match_started_at ?? null,
    secondsSinceMatchStart: row.seconds_since_match_start ?? null,
    capturedPoolStatus: row.captured_pool_status,
    createdAt: row.created_at,
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
    const closesAt = new Date(
      data.startedAt * 1000 + 5 * 60 * 1000
    ).toISOString();

    const { error } = await supabase.from("betting_pools").insert({
      faceit_match_id: data.faceitMatchId,
      team1_name: data.team1Name,
      team2_name: data.team2Name,
      opens_at: opensAt,
      closes_at: closesAt,
      match_started_at: opensAt,
    });
    // Conflict (already exists) is silently ignored
    if (error && error.code !== "23505") {
      console.error("createBettingPool error:", error.message);
    }
    return { ok: true };
  });

// ── getBettingPool ────────────────────────────────────────────

export const getBettingPool = createServerFn({ method: "GET" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(
    async ({
      data: faceitMatchId,
    }): Promise<{
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

      if (!poolRow) {
        return { pool: null, userBet: null, userCoins: 0 };
      }

      // Get user's bet if any — need user id from session (client-side context)
      // userBet fetched client-side via useBettingPool hook
      return { pool: rowToPool(poolRow), userBet: null, userCoins: 0 };
    }
  );

// ── placeBet ──────────────────────────────────────────────────

export const placeBet = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      seasonId: string;
      poolId?: string;
      propPoolId?: string;
      side: string;
      amount: number;
      userId: string;
    }) => input
  )
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const supabase = createServerSupabase();
    const { data: result, error } = await supabase.rpc("place_bet", {
      p_user_id: data.userId,
      p_season_id: data.seasonId,
      p_pool_id: data.poolId ?? null,
      p_prop_pool_id: data.propPoolId ?? null,
      p_side: data.side,
      p_amount: data.amount,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const parsed = result as any;
    if (parsed?.error) {
      return { success: false, error: parsed.error };
    }
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

// ── getCoinBalance ────────────────────────────────────────────

export const getCoinBalance = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<number> => {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();
    return (data as any)?.coins ?? 0;
  });

// ── getPropPoolsForMatch ─────────────────────────────────────

export const getPropPoolsForMatch = createServerFn({ method: "GET" })
  .inputValidator((faceitMatchId: string) => faceitMatchId)
  .handler(async ({ data: faceitMatchId }): Promise<PropPool[]> => {
    const supabase = createServerSupabase();
    const { data: rows } = await supabase
      .from("prop_pools")
      .select("*")
      .eq("faceit_match_id", faceitMatchId)
      .order("player_nickname", { ascending: true });

    return (rows ?? []).map((row: any) => ({
      id: row.id,
      seasonId: row.season_id,
      faceitMatchId: row.faceit_match_id,
      playerId: row.player_id,
      playerNickname: row.player_nickname,
      statKey: row.stat_key,
      threshold: Number(row.threshold),
      description: row.description,
      yesPool: row.yes_pool,
      noPool: row.no_pool,
      outcome: row.outcome,
      status: row.status,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    }));
  });

// ── getUserBetForMatch ────────────────────────────────────────

export const getUserBetForMatch = createServerFn({ method: "GET" })
  .inputValidator((input: { faceitMatchId: string; userId: string }) => input)
  .handler(async ({ data }): Promise<Bet | null> => {
    const supabase = createServerSupabase();

    const { data: poolRow } = await supabase
      .from("betting_pools")
      .select("id")
      .eq("faceit_match_id", data.faceitMatchId)
      .single();

    if (!poolRow) {
      return null;
    }

    const { data: betRow } = await supabase
      .from("bets")
      .select("*")
      .eq("pool_id", poolRow.id)
      .eq("user_id", data.userId)
      .single();

    if (!betRow) {
      return null;
    }

    return {
      id: betRow.id,
      poolId: betRow.pool_id,
      propPoolId: null,
      userId: betRow.user_id,
      side: betRow.side,
      amount: betRow.amount,
      payout: betRow.payout,
      createdAt: betRow.created_at,
    };
  });

export const getUserPropBetsForMatch = createServerFn({ method: "GET" })
  .inputValidator((input: { faceitMatchId: string; userId: string }) => input)
  .handler(async ({ data }): Promise<Bet[]> => {
    const supabase = createServerSupabase();

    const { data: propRows } = await supabase
      .from("prop_pools")
      .select("id")
      .eq("faceit_match_id", data.faceitMatchId);

    const propPoolIds = (propRows ?? []).map((row: any) => row.id).filter(Boolean);

    if (!propPoolIds.length) {
      return [];
    }

    const { data: betRows } = await supabase
      .from("bets")
      .select("*")
      .eq("user_id", data.userId)
      .in("prop_pool_id", propPoolIds);

    return (betRows ?? []).map((betRow: any) => ({
      id: betRow.id,
      poolId: betRow.pool_id,
      propPoolId: betRow.prop_pool_id,
      userId: betRow.user_id,
      side: betRow.side,
      amount: betRow.amount,
      payout: betRow.payout,
      createdAt: betRow.created_at,
    }));
  });

// ── getUserBetHistory ─────────────────────────────────────────

export const getUserBetHistory = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<BetHistoryItem[]> => {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("bets")
      .select("*, betting_pools(*), prop_pools(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const betIds = (data ?? []).map((row: any) => row.id).filter(Boolean);
    const { data: auditRows } = betIds.length
      ? await supabase.from("bet_audit_events").select("*").in("bet_id", betIds)
      : { data: [] };
    const auditByBetId = new Map(
      (auditRows ?? []).map((row: any) => [row.bet_id, rowToBetAuditEvent(row)])
    );

    return (data ?? []).flatMap((row: any) => {
      const baseBet = {
        id: row.id,
        poolId: row.pool_id,
        propPoolId: row.prop_pool_id,
        userId: row.user_id,
        side: row.side,
        amount: row.amount,
        payout: row.payout,
        createdAt: row.created_at,
        audit: auditByBetId.get(row.id) ?? null,
      };

      if (row.betting_pools) {
        return [
          {
            ...baseBet,
            kind: "match" as const,
            pool: rowToPool(row.betting_pools),
          },
        ];
      }

      if (row.prop_pools) {
        return [
          {
            ...baseBet,
            kind: "prop" as const,
            prop: rowToPropPool(row.prop_pools),
          },
        ];
      }

      return [];
    });
  });

export const getBetAuditLog = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { faceitMatchId?: string; userId?: string; limit?: number }) =>
      input
  )
  .handler(async ({ data }): Promise<BetAuditEvent[]> => {
    const supabase = createServerSupabase();
    const limit = Math.max(1, Math.min(data.limit ?? 100, 500));

    let query = supabase.from("bet_audit_events").select("*");

    if (data.faceitMatchId) {
      query = query.eq("faceit_match_id", data.faceitMatchId);
    } else if (data.userId) {
      query = query.eq("user_id", data.userId);
    }

    const { data: rows } = await query.order("created_at", {
      ascending: false,
    });
    return (rows ?? []).slice(0, limit).map(rowToBetAuditEvent);
  });
