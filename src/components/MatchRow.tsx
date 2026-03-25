import { Link } from "@tanstack/react-router";
import { MapBadge } from "./MapBadge";

interface MatchRowProps {
  adr: number;
  eloDelta?: number | null;
  hsPercent: number;
  kdRatio: number;
  map: string;
  matchId?: string;
  nickname: string;
  queueBucket?: "solo" | "party" | "unknown";
  score: string;
  win: boolean;
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
      className={`flex items-center rounded border-l-[3px] bg-bg-card px-2.5 py-2 text-xs ${
        win ? "border-accent" : "border-error"
      } ${matchId ? "cursor-pointer transition-colors hover:bg-bg-elevated" : ""}`}
    >
      <span className={`w-5 font-bold ${win ? "text-accent" : "text-error"}`}>
        {win ? "W" : "L"}
      </span>
      <span className="w-20 truncate text-text">{nickname}</span>
      <span className="w-20">
        <MapBadge map={map} />
      </span>
      <span className="w-14 text-text-muted">{score}</span>
      <span className="flex-1 text-text-muted">
        K/D {kdRatio.toFixed(1)} · ADR {adr.toFixed(0)} · HS {hsPercent}%
      </span>
      {queueBucket && queueBucket !== "unknown" && (
        <span className="mr-2 text-[10px] text-text-muted uppercase tracking-wide">
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
      <Link params={{ matchId }} to="/match/$matchId">
        {content}
      </Link>
    );
  }

  return content;
}
