import { getFriendScoreboardPlayers } from "~/lib/live-match";
import type { MatchPlayerStats } from "~/lib/types";

interface LiveScoreboardProps {
  friendIds: string[];
  players: MatchPlayerStats[];
}

export function LiveScoreboard({ friendIds, players }: LiveScoreboardProps) {
  const friendStats = getFriendScoreboardPlayers(players, friendIds);

  if (friendStats.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-border border-t pt-3">
      <div className="mb-2 text-[10px] text-text-dim uppercase tracking-wider">
        Live Squad Stats
      </div>

      <div className="mb-1 grid grid-cols-[1fr_32px_32px_32px_40px_36px] gap-1 px-1 text-[9px] text-text-dim">
        <span>Player</span>
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
      </div>

      {friendStats.map((player, index) => (
        <div
          className={`mb-0.5 grid grid-cols-[1fr_32px_32px_32px_40px_36px] items-center gap-1 rounded px-1 py-1.5 text-[11px] ${
            index === 0 ? "bg-accent/8" : "bg-bg-elevated"
          }`}
          key={player.playerId}
        >
          <span
            className={index === 0 ? "font-semibold text-accent" : "text-text"}
          >
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
