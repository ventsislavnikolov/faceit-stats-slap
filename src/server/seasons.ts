import { createServerFn } from "@tanstack/react-start";
import { createServerSupabase } from "~/lib/supabase.server";
import type { Season, SeasonLeaderboardEntry } from "~/lib/types";

// ── Helpers ──────────────────────────────────────────────────

function rowToSeason(row: any): Season {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    status: row.status,
    prizes: row.prizes ?? [],
    createdAt: row.created_at,
  };
}

// ── getActiveSeason ─────────────────────────────────────────

export const getActiveSeason = createServerFn({ method: "GET" }).handler(
  async (): Promise<Season | null> => {
    const supabase = createServerSupabase();
    const now = new Date().toISOString();

    // Auto-complete active season if past ends_at
    const { data: activeRows } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "active");

    if (activeRows && activeRows.length > 0) {
      const active = activeRows[0];
      if (now >= active.ends_at) {
        await supabase
          .from("seasons")
          .update({ status: "completed" })
          .eq("id", active.id);
        // Fall through to check for upcoming season
      } else {
        return rowToSeason(active);
      }
    }

    // Check for upcoming season that should be activated
    const { data: upcomingRows } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "upcoming")
      .order("starts_at", { ascending: true });

    if (upcomingRows && upcomingRows.length > 0) {
      const upcoming = upcomingRows[0];
      if (now >= upcoming.starts_at) {
        const { data: activated } = await supabase
          .from("seasons")
          .update({ status: "active" })
          .eq("id", upcoming.id)
          .select("*")
          .single();

        if (activated) {
          return rowToSeason(activated);
        }
      }
    }

    return null;
  }
);

// ── getSeasonCoinBalance ────────────────────────────────────

export const getSeasonCoinBalance = createServerFn({ method: "GET" })
  .inputValidator((input: { seasonId: string; userId: string }) => input)
  .handler(async ({ data }): Promise<number> => {
    const supabase = createServerSupabase();
    const { data: row } = await supabase
      .from("season_participants")
      .select("coins")
      .eq("season_id", data.seasonId)
      .eq("user_id", data.userId)
      .single();

    return (row as any)?.coins ?? 1000;
  });

// ── getSeasonLeaderboard ────────────────────────────────────

export const getSeasonLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((seasonId: string) => seasonId)
  .handler(async ({ data: seasonId }): Promise<SeasonLeaderboardEntry[]> => {
    const supabase = createServerSupabase();

    const { data: participants } = await supabase
      .from("season_participants")
      .select("user_id, coins")
      .eq("season_id", seasonId)
      .order("coins", { ascending: false });

    if (!participants || participants.length === 0) {
      return [];
    }

    const userIds = participants.map((p: any) => p.user_id);

    // Join with profiles for nicknames
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", userIds);

    const nicknameMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p.nickname])
    );

    // Count bets per user for this season via prop_pools + bets
    const { data: propPools } = await supabase
      .from("prop_pools")
      .select("id")
      .eq("season_id", seasonId);

    const propPoolIds = (propPools ?? []).map((p: any) => p.id);

    const betCountMap = new Map<string, number>();

    if (propPoolIds.length > 0) {
      const { data: bets } = await supabase
        .from("bets")
        .select("user_id")
        .in("prop_pool_id", propPoolIds);

      for (const bet of bets ?? []) {
        betCountMap.set(bet.user_id, (betCountMap.get(bet.user_id) ?? 0) + 1);
      }
    }

    return participants.map((p: any) => {
      const betsPlaced = betCountMap.get(p.user_id) ?? 0;
      return {
        userId: p.user_id,
        nickname: nicknameMap.get(p.user_id) ?? "Unknown",
        coins: p.coins,
        betsPlaced,
        betsWon: 0,
        winRate: 0,
      };
    });
  });

// ── createSeason ────────────────────────────────────────────

export const createSeason = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      name: string;
      startsAt: string;
      endsAt: string;
      prizes: { place: number; description: string }[];
      userId: string;
    }) => input
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; season?: Season; error?: string }> => {
      const supabase = createServerSupabase();

      // Admin check
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", data.userId)
        .single();

      if ((profile as any)?.nickname !== "soavarice") {
        return { success: false, error: "Unauthorized: admin only" };
      }

      // Validate no overlapping non-completed seasons
      const { data: overlapping } = await supabase
        .from("seasons")
        .select("id")
        .in("status", ["upcoming", "active"]);

      if (overlapping && overlapping.length > 0) {
        return {
          success: false,
          error: "An active or upcoming season already exists",
        };
      }

      const { data: row, error } = await supabase
        .from("seasons")
        .insert({
          name: data.name,
          starts_at: data.startsAt,
          ends_at: data.endsAt,
          prizes: data.prizes,
          created_by: data.userId,
          status: "upcoming",
        })
        .select("*")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, season: rowToSeason(row) };
    }
  );

// ── completeSeason ──────────────────────────────────────────

export const completeSeason = createServerFn({ method: "POST" })
  .inputValidator((seasonId: string) => seasonId)
  .handler(
    async ({
      data: seasonId,
    }): Promise<{ success: boolean; error?: string }> => {
      const supabase = createServerSupabase();

      const { error } = await supabase
        .from("seasons")
        .update({ status: "completed" })
        .eq("id", seasonId)
        .eq("status", "active");

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    }
  );

// ── getSeasonHistory ────────────────────────────────────────

export const getSeasonHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<Season[]> => {
    const supabase = createServerSupabase();

    const { data: rows } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "completed")
      .order("ends_at", { ascending: false });

    return (rows ?? []).map(rowToSeason);
  }
);
