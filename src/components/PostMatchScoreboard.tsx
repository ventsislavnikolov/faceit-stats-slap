// src/components/PostMatchScoreboard.tsx
import type { MatchPlayerStats } from "~/lib/types";
import { getBanterLine } from "~/lib/banter";

interface PostMatchScoreboardProps {
  matchId: string;
  friendIds: string[];
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

  if (friendStats.length === 0) return null;

  const topFragger = friendStats[0];
  const bottomFragger = friendStats[friendStats.length - 1];
  const showBanter = friendStats.length >= 2;

  const multiKills = friendStats.filter(
    (p) => p.tripleKills > 0 || p.quadroKills > 0 || p.pentaKills > 0
  );

  return (
    <div className="border-t border-border mt-3 pt-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">
        Your Squad
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 text-[9px] text-text-dim mb-1 px-1">
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
          <span className="text-text-dim text-[10px] text-center">
            {i + 1}
          </span>
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
            key={player.playerId}
            className={`grid grid-cols-[20px_1fr_32px_32px_32px_40px_32px_36px_32px] gap-1 text-[11px] px-1 py-1.5 rounded ${rowBg} mb-0.5 items-center`}
          >
            {rankDisplay}
            <span className={nameColor}>{player.nickname}</span>
            <span className={`text-center ${isTop ? "font-bold text-text" : statsColor}`}>
              {player.kills}
            </span>
            <span className={`text-center ${statsColor}`}>
              {player.deaths}
            </span>
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
            <span className={`text-center ${statsColor}`}>
              {player.mvps}
            </span>
          </div>
        );
      })}

      {/* Multi-kill badges */}
      {multiKills.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {multiKills.map((p) => {
            const parts: string[] = [];
            if (p.tripleKills > 0) parts.push(`${p.tripleKills}x Triple`);
            if (p.quadroKills > 0) parts.push(`${p.quadroKills}x Quadro`);
            if (p.pentaKills > 0) parts.push(`${p.pentaKills}x Penta`);
            return (
              <span
                key={p.playerId}
                className="bg-accent/10 text-accent text-[9px] px-1.5 py-0.5 rounded"
              >
                {p.nickname}: {parts.join(", ")}
              </span>
            );
          })}
        </div>
      )}

      {/* Banter */}
      {showBanter && (
        <div className="border-t border-border mt-3 pt-2.5 text-center">
          <span className="text-text-muted text-[11px] italic">
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
