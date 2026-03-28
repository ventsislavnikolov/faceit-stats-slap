import { createServerFn } from "@tanstack/react-start";
import { getTwitchChannel } from "~/lib/constants";
import {
  fetchPlayer,
  fetchPlayerByNickname,
  fetchPlayerLifetimeStats,
} from "~/lib/faceit";
import type { FriendWithStats } from "~/lib/types";

const FRIEND_LIMIT = 100;
const FACEIT_BATCH_SIZE = 3;
const BATCH_DELAY_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolvePlayer = createServerFn({ method: "GET" })
  .inputValidator((input: string) => input)
  .handler(
    async ({
      data: input,
    }): Promise<{ faceitId: string; nickname: string }> => {
      const trimmed = input.trim();
      const player = UUID_RE.test(trimmed)
        ? await fetchPlayer(trimmed)
        : await fetchPlayerByNickname(trimmed);
      return { faceitId: player.faceitId, nickname: player.nickname };
    }
  );

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
        : await fetchPlayerByNickname(trimmed);

      const { friendsIds, ...player } = raw;
      const totalFriends = friendsIds.length;
      const limited = totalFriends > FRIEND_LIMIT;
      const idsToFetch = friendsIds.slice(0, FRIEND_LIMIT);

      const friends: FriendWithStats[] = [];
      for (let i = 0; i < idsToFetch.length; i += FACEIT_BATCH_SIZE) {
        if (i > 0) {
          await sleep(BATCH_DELAY_MS);
        }
        const batch = idsToFetch.slice(i, i + FACEIT_BATCH_SIZE);
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
          if (r.status === "fulfilled") {
            friends.push(r.value);
          }
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
