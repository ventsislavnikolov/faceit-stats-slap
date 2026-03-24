import { Link } from "@tanstack/react-router";
import { MapBadge } from "./MapBadge";
import type { MatchQueueBucket } from "~/lib/types";

interface HistoryMatchRow {
  nickname: string;
  matchId: string;
  map: string;
  score: string;
  kills: number;
  kdRatio: number;
  krRatio: number;
  adr: number;
  hsPercent: number;
  result: boolean;
  queueBucket?: MatchQueueBucket;
}

interface HistoryMatchesTableProps {
  matches: HistoryMatchRow[];
}

const HISTORY_MATCHES_GRID_TEMPLATE = "3rem 26.5rem repeat(7, 5rem)";

function getQueueLabel(queueBucket?: MatchQueueBucket) {
  if (queueBucket === "solo") return "SOLO";
  if (queueBucket === "party") return "PARTY";
  return "—";
}

export function HistoryMatchesTable({ matches }: HistoryMatchesTableProps) {
  if (!matches.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">No recent matches</div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[50rem] gap-2 px-3 pb-1 text-[10px] uppercase tracking-wider text-text-dim"
          style={{ gridTemplateColumns: HISTORY_MATCHES_GRID_TEMPLATE }}
        >
          <span>Result</span>
          <span>Map</span>
          <span className="text-right">Score</span>
          <span className="text-right">Kills</span>
          <span className="text-right">K/D</span>
          <span className="text-right">K/R</span>
          <span className="text-right">ADR</span>
          <span className="text-right">HS%</span>
          <span className="text-right">Queue</span>
        </div>

        <div className="flex flex-col gap-1">
          {matches.map((match) => (
            <Link
              key={`${match.matchId}-${match.nickname}`}
              to="/match/$matchId"
              params={{ matchId: match.matchId }}
              className={`grid min-w-[50rem] gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-bg-card ${
                match.result
                  ? "border-l-2 border-accent bg-bg-elevated"
                  : "border-l-2 border-error bg-bg-elevated"
              }`}
              style={{ gridTemplateColumns: HISTORY_MATCHES_GRID_TEMPLATE }}
            >
              <span className={`text-xs font-bold ${match.result ? "text-accent" : "text-error"}`}>
                {match.result ? "WIN" : "LOSS"}
              </span>
              <span className="min-w-0">
                <MapBadge map={match.map} />
              </span>
              <span className="text-right text-text-muted">{match.score}</span>
              <span className="text-right text-text-muted">{match.kills}</span>
              <span className="text-right text-text-muted">{match.kdRatio.toFixed(1)}</span>
              <span className="text-right text-text-muted">{match.krRatio.toFixed(2)}</span>
              <span className="text-right text-text-muted">{match.adr.toFixed(0)}</span>
              <span className="text-right text-text-muted">{match.hsPercent}%</span>
              <span className="text-right text-xs tracking-wide text-text-muted">
                {getQueueLabel(match.queueBucket)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
