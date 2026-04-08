import { getBanterLine } from "~/lib/banter";
import { getFriendScoreboardPlayers } from "~/lib/live-match";
import type { MatchPlayerStats } from "~/lib/types";

interface TrackedMatchBanterProps {
  friendIds: string[];
  matchId: string;
  players: MatchPlayerStats[];
}

export function TrackedMatchBanter({
  friendIds,
  matchId,
  players,
}: TrackedMatchBanterProps) {
  const friendStats = getFriendScoreboardPlayers(players, friendIds);

  if (friendStats.length < 2) {
    return null;
  }

  const topFragger = friendStats[0];
  const bottomFragger = friendStats[friendStats.length - 1];

  return (
    <div className="border-border border-t pt-3 text-center">
      <span className="text-[11px] text-text-muted italic">
        {getBanterLine("carry", topFragger.nickname, matchId)}
        {". "}
        {getBanterLine("roast", bottomFragger.nickname, matchId)}
        {"."}
      </span>
    </div>
  );
}
