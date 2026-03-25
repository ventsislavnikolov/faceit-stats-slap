// src/components/PostMatchScoreboard.tsx

import { getBanterLine } from "~/lib/banter";
import type { MatchPlayerStats } from "~/lib/types";

interface PostMatchScoreboardProps {
  friendIds: string[];
  matchId: string;
  players: MatchPlayerStats[];
}

export function PostMatchScoreboard({
  matchId,
  friendIds,
  players,
}: PostMatchScoreboardProps) {
  const friendSet = new Set(friendIds);
  const friendStats = players
    .filter((p) => friendSet.has(p.playerId))
    .sort((a, b) => b.kills - a.kills);

  if (friendStats.length === 0) {
    return null;
  }

  const topFragger = friendStats[0];
  const bottomFragger = friendStats[friendStats.length - 1];
  const showBanter = friendStats.length >= 2;

  const multiKills = friendStats.filter(
    (p) => p.tripleKills > 0 || p.quadroKills > 0 || p.pentaKills > 0
  );

  return (
    <div className="mt-3 border-border border-t pt-3">
      <div className="mb-2 text-[10px] text-text-dim uppercase tracking-wider">
        Your Squad
      </div>

      {/* Table header */}
      <div className="mb-1 grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 px-1 text-[9px] text-text-dim">
        <span />
        <span />
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
        <span className="text-center">HS%</span>
        <span className="text-center">MVP</span>
      </div>

      {/* Player rows */}
      {friendStats.map((player, i) => {
        const isTop = i === 0;
        const isBottom = i === friendStats.length - 1 && friendStats.length > 1;

        let rowBg = "";
        let nameColor = "text-text";
        let statsColor = "text-text";
        let rankDisplay: React.ReactNode = (
          <span className="text-center text-[10px] text-text-dim">{i + 1}</span>
        );

        if (isTop) {
          rowBg = "bg-accent/8";
          nameColor = "text-accent font-semibold";
          rankDisplay = <span className="text-sm">&#x1F451;</span>;
        } else if (isBottom) {
          rowBg = "bg-error/5";
          nameColor = "text-text-muted";
          statsColor = "text-text-muted";
          rankDisplay = <span className="text-xs">&#x1F480;</span>;
        }

        return (
          <div
            className={`grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 rounded px-1 py-1.5 text-[11px] ${rowBg} mb-0.5 items-center`}
            key={player.playerId}
          >
            {rankDisplay}
            <span className={nameColor}>{player.nickname}</span>
            <span
              className={`text-center ${isTop ? "font-bold text-text" : statsColor}`}
            >
              {player.kills}
            </span>
            <span className={`text-center ${statsColor}`}>{player.deaths}</span>
            <span className={`text-center ${statsColor}`}>
              {player.assists}
            </span>
            <span
              className={`text-center font-bold ${
                player.kdRatio >= 1 ? "text-accent" : "text-error/70"
              }`}
            >
              {player.kdRatio.toFixed(2)}
            </span>
            <span className={`text-center ${statsColor}`}>
              {Math.round(player.adr)}
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.hsPercent}%
            </span>
            <span className={`text-center ${statsColor}`}>{player.mvps}</span>
          </div>
        );
      })}

      {/* Multi-kill badges */}
      {multiKills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {multiKills.map((p) => {
            const parts: string[] = [];
            if (p.tripleKills > 0) {
              parts.push(`${p.tripleKills}x Triple`);
            }
            if (p.quadroKills > 0) {
              parts.push(`${p.quadroKills}x Quadro`);
            }
            if (p.pentaKills > 0) {
              parts.push(`${p.pentaKills}x Penta`);
            }
            return (
              <span
                className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent"
                key={p.playerId}
              >
                {p.nickname}: {parts.join(", ")}
              </span>
            );
          })}
        </div>
      )}

      {/* Banter */}
      {showBanter && (
        <div className="mt-3 border-border border-t pt-2.5 text-center">
          <span className="text-[11px] text-text-muted italic">
            {getBanterLine("carry", topFragger.nickname, matchId)}
            {". "}
            {getBanterLine("roast", bottomFragger.nickname, matchId)}
            {"."}
          </span>
        </div>
      )}
    </div>
  );
}
