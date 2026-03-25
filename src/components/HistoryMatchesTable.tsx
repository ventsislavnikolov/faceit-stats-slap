import { Link } from "@tanstack/react-router";
import type { MatchQueueBucket } from "~/lib/types";
import { MapBadge } from "./MapBadge";

interface HistoryMatchRow {
  adr: number;
  hasDemoAnalytics?: boolean;
  hsPercent: number;
  kdRatio: number;
  kills: number;
  krRatio: number;
  map: string;
  matchId: string;
  nickname: string;
  queueBucket?: MatchQueueBucket;
  result: boolean;
  score: string;
}

interface HistoryMatchesTableProps {
  matches: HistoryMatchRow[];
}

const HISTORY_MATCHES_GRID_TEMPLATE = "3rem 24rem 2.5rem repeat(7, 5rem)";

function getQueueLabel(queueBucket?: MatchQueueBucket) {
  if (queueBucket === "solo") {
    return "SOLO";
  }
  if (queueBucket === "party") {
    return "PARTY";
  }
  return "—";
}

function HeaderWithTooltip({
  children,
  tooltip,
  align = "left",
}: {
  children: React.ReactNode;
  tooltip: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <span
      className={`group/hdr relative cursor-help ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}
    >
      {children}
      <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-bg-card px-2 py-1 font-normal text-[9px] text-text normal-case tracking-normal shadow-lg group-hover/hdr:block">
        {tooltip}
      </span>
    </span>
  );
}

export function HistoryMatchesTable({ matches }: HistoryMatchesTableProps) {
  if (!matches.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No recent matches
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[50rem] gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
          style={{ gridTemplateColumns: HISTORY_MATCHES_GRID_TEMPLATE }}
        >
          <span>Result</span>
          <span>Map</span>
          <HeaderWithTooltip
            align="center"
            tooltip="Demo analytics parsed from match replay"
          >
            Demo
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Match score">
            Score
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Total kills">
            Kills
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Kill/Death ratio">
            K/D
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Kill/Round ratio">
            K/R
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Average Damage per Round">
            ADR
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Headshot percentage">
            HS%
          </HeaderWithTooltip>
          <HeaderWithTooltip align="right" tooltip="Queue type — Solo or Party">
            Queue
          </HeaderWithTooltip>
        </div>

        <div className="flex flex-col gap-1">
          {matches.map((match) => (
            <Link
              className={`grid min-w-[50rem] gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-bg-card ${
                match.result
                  ? "border-accent border-l-2 bg-bg-elevated"
                  : "border-error border-l-2 bg-bg-elevated"
              }`}
              key={`${match.matchId}-${match.nickname}`}
              params={{ matchId: match.matchId }}
              style={{ gridTemplateColumns: HISTORY_MATCHES_GRID_TEMPLATE }}
              to="/match/$matchId"
            >
              <span
                className={`font-bold text-xs ${match.result ? "text-accent" : "text-error"}`}
              >
                {match.result ? "WIN" : "LOSS"}
              </span>
              <span className="min-w-0">
                <MapBadge map={match.map} />
              </span>
              <span
                className="text-center"
                title={
                  match.hasDemoAnalytics
                    ? "Demo analytics available"
                    : "No demo analytics"
                }
              >
                {match.hasDemoAnalytics ? (
                  <span className="text-accent text-xs">&#x2713;</span>
                ) : (
                  <span className="text-text-dim/40 text-xs">&#x2717;</span>
                )}
              </span>
              <span className="text-right text-text-muted">{match.score}</span>
              <span className="text-right text-text-muted">{match.kills}</span>
              <span className="text-right text-text-muted">
                {match.kdRatio.toFixed(1)}
              </span>
              <span className="text-right text-text-muted">
                {match.krRatio.toFixed(2)}
              </span>
              <span className="text-right text-text-muted">
                {match.adr.toFixed(0)}
              </span>
              <span className="text-right text-text-muted">
                {match.hsPercent}%
              </span>
              <span className="text-right text-text-muted text-xs tracking-wide">
                {getQueueLabel(match.queueBucket)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
