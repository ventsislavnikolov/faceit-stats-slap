import type { MatchPlayerStats } from "~/lib/types";
import { getFriendScoreboardPlayers } from "~/lib/live-match";

interface LiveScoreboardProps {
  friendIds: string[];
  players: MatchPlayerStats[];
}

export function LiveScoreboard({ friendIds, players }: LiveScoreboardProps) {
  const friendStats = getFriendScoreboardPlayers(players, friendIds);

  if (friendStats.length === 0) return null;

  return (
    <div className="border-t border-border mt-3 pt-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">
        Live Squad Stats
      </div>

      <div className="grid grid-cols-[1fr_32px_32px_32px_40px_36px] gap-1 text-[9px] text-text-dim mb-1 px-1">
        <span>Player</span>
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
      </div>

      {friendStats.map((player, index) => (
        <div
          key={player.playerId}
          className={`grid grid-cols-[1fr_32px_32px_32px_40px_36px] gap-1 text-[11px] px-1 py-1.5 rounded mb-0.5 items-center ${
            index === 0 ? "bg-accent/8" : "bg-bg-elevated"
          }`}
        >
          <span className={index === 0 ? "text-accent font-semibold" : "text-text"}>
            {player.nickname}
          </span>
          <span className="text-center text-text">{player.kills}</span>
          <span className="text-center text-text-muted">{player.deaths}</span>
          <span className="text-center text-text-muted">{player.assists}</span>
          <span
            className={`text-center font-bold ${
              player.kdRatio >= 1 ? "text-accent" : "text-error/70"
            }`}
          >
            {player.kdRatio.toFixed(2)}
          </span>
          <span className="text-center text-text-muted">
            {Math.round(player.adr)}
          </span>
        </div>
      ))}
    </div>
  );
}
