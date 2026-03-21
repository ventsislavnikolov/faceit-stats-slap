import { createServerFn } from "@tanstack/react-start";
import { TRACKED_FRIENDS, getTwitchChannel } from "~/lib/constants";
import {
  fetchPlayer,
  fetchPlayerByNickname,
  fetchPlayerLifetimeStats,
} from "~/lib/faceit";
import { createServerSupabase } from "~/lib/supabase.server";
import type { FriendWithStats } from "~/lib/types";

const FRIEND_LIMIT = 20;
const BATCH_DELAY_MS = 150;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const searchAndLoadFriends = createServerFn({ method: "GET" })
  .inputValidator((input: string) => input)
  .handler(
    async ({
      data: input,
    }): Promise<{
      player: { faceitId: string; nickname: string };
      friends: FriendWithStats[];
      totalFriends: number;
      limited: boolean;
    }> => {
      const trimmed = input.trim();
      const raw = UUID_RE.test(trimmed)
        ? await fetchPlayer(trimmed)
        : await fetchPlayerByNickname(trimmed.toLowerCase());

      const { friendsIds, ...player } = raw;
      const totalFriends = friendsIds.length;
      const limited = totalFriends > FRIEND_LIMIT;
      const idsToFetch = friendsIds.slice(0, FRIEND_LIMIT);

      const friends: FriendWithStats[] = [];
      for (let i = 0; i < idsToFetch.length; i += 5) {
        if (i > 0) await sleep(BATCH_DELAY_MS);
        const batch = idsToFetch.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (id) => {
            const [p, stats] = await Promise.all([
              fetchPlayer(id),
              fetchPlayerLifetimeStats(id),
            ]);
            return {
              ...p,
              ...stats,
              twitchChannel: getTwitchChannel(id),
              isPlaying: false,
              currentMatchId: null,
            } satisfies FriendWithStats;
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled") friends.push(r.value);
        }
      }

      return {
        player: { faceitId: player.faceitId, nickname: player.nickname },
        friends,
        totalFriends,
        limited,
      };
    }
  );

export const getFriends = createServerFn({ method: "GET" }).handler(
  async (): Promise<FriendWithStats[]> => {
    const supabase = createServerSupabase();
    const CACHE_TTL_MS = 30 * 60 * 1000;
    const now = Date.now();

    const { data: cached } = await supabase
      .from("tracked_friends")
      .select("*")
      .order("nickname");

    const staleIds = new Set<string>();
    const freshFriends: FriendWithStats[] = [];

    for (const id of TRACKED_FRIENDS) {
      const row = cached?.find((r: any) => r.faceit_id === id);
      if (
        row &&
        row.updated_at &&
        now - new Date(row.updated_at).getTime() < CACHE_TTL_MS
      ) {
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

    const staleFriends: FriendWithStats[] = [];
    const staleArray = [...staleIds];
    for (let i = 0; i < staleArray.length; i += 5) {
      if (i > 0) await sleep(BATCH_DELAY_MS);
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
          staleFriends.push(result.value);
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

    return [...freshFriends, ...staleFriends];
  }
);
