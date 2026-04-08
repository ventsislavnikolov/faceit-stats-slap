import { createServerSupabase } from "~/lib/supabase.server";
import type { TrackedPlayer } from "~/lib/types";

export type TrackedPlayerSnapshot = Pick<TrackedPlayer, "faceitId" | "nickname">;

type TrackedFriendRow = {
  faceit_id: string;
  nickname: string;
};

export async function loadTrackedPlayersSnapshot(): Promise<
  TrackedPlayerSnapshot[]
> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("tracked_friends")
    .select("faceit_id, nickname")
    .eq("is_active", true)
    .order("nickname");

  return ((data ?? []) as TrackedFriendRow[]).map((row) => ({
    faceitId: row.faceit_id,
    nickname: row.nickname,
  }));
}
