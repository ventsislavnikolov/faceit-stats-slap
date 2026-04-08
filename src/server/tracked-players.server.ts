import { createServerSupabase } from "~/lib/supabase.server";
import type { TrackedPlayer } from "~/lib/types";

type TrackedFriendRow = {
  faceit_id: string;
  nickname: string;
};

export async function loadTrackedPlayersSnapshot(): Promise<TrackedPlayer[]> {
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
