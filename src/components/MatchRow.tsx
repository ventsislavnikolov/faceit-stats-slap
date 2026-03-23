import { Link } from "@tanstack/react-router";
import { MapBadge } from "./MapBadge";

interface MatchRowProps {
  nickname: string;
  matchId?: string;
  map: string;
  score: string;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  win: boolean;
  eloDelta?: number | null;
  queueBucket?: "solo" | "party" | "unknown";
}

export function MatchRow({
  nickname,
  matchId,
  map,
  score,
  kdRatio,
  adr,
  hsPercent,
  win,
  eloDelta,
  queueBucket,
}: MatchRowProps) {
  const content = (
    <div
      className={`flex items-center bg-bg-card rounded px-2.5 py-2 text-xs border-l-[3px] ${
        win ? "border-accent" : "border-error"
      } ${matchId ? "hover:bg-bg-elevated cursor-pointer transition-colors" : ""}`}
    >
      <span className={`font-bold w-5 ${win ? "text-accent" : "text-error"}`}>
        {win ? "W" : "L"}
      </span>
      <span className="text-text w-20 truncate">{nickname}</span>
      <span className="w-20">
        <MapBadge map={map} />
      </span>
      <span className="text-text-muted w-14">{score}</span>
      <span className="text-text-muted flex-1">
        K/D {kdRatio.toFixed(1)} · ADR {adr.toFixed(0)} · HS {hsPercent}%
      </span>
      {queueBucket && queueBucket !== "unknown" && (
        <span className="text-[10px] uppercase tracking-wide text-text-muted mr-2">
          {queueBucket}
        </span>
      )}
      {eloDelta != null && (
        <span className={eloDelta >= 0 ? "text-accent" : "text-error"}>
          {eloDelta >= 0 ? "+" : ""}
          {eloDelta}
        </span>
      )}
    </div>
  );

  if (matchId) {
    return (
      <Link to="/match/$matchId" params={{ matchId }}>
        {content}
      </Link>
    );
  }

  return content;
}
