import { Fragment, useState } from "react";
import { PlayerSessionBreakdown } from "~/components/last-party/PlayerSessionBreakdown";
import type { AggregatePlayerStats } from "~/lib/types";

interface SessionStatsTableProps {
  allHaveDemo: boolean;
  stats: Record<string, AggregatePlayerStats>;
}

interface SessionStatsTableViewProps {
  allHaveDemo: boolean;
  entries: AggregatePlayerStats[];
  expandedPlayerId: string | null;
  onToggleExpandedPlayer: (playerId: string) => void;
}

const ratingColor = (r: number) =>
  r >= 1.2
    ? "text-yellow-400"
    : r >= 1.0
      ? "text-accent"
      : r >= 0.8
        ? "text-orange-400"
        : "text-error";

const kdColor = (kd: number) => (kd >= 1 ? "text-accent" : "text-error/70");

export const toggleExpandedPlayerId = (
  currentPlayerId: string | null,
  nextPlayerId: string
) => (currentPlayerId === nextPlayerId ? null : nextPlayerId);

export function SessionStatsTable({
  stats,
  allHaveDemo,
}: SessionStatsTableProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const entries = Object.values(stats).sort(
    (a, b) =>
      (b.sessionScore ?? b.avgImpact) - (a.sessionScore ?? a.avgImpact) ||
      b.avgImpact - a.avgImpact ||
      (allHaveDemo
        ? (b.avgRating ?? 0) - (a.avgRating ?? 0)
        : b.avgKd - a.avgKd)
  );

  if (entries.length === 0) {
    return null;
  }

  const onToggleExpandedPlayer = (playerId: string) => {
    setExpandedPlayerId((current) => toggleExpandedPlayerId(current, playerId));
  };

  return (
    <SessionStatsTableView
      allHaveDemo={allHaveDemo}
      entries={entries}
      expandedPlayerId={expandedPlayerId}
      onToggleExpandedPlayer={onToggleExpandedPlayer}
    />
  );
}

export function SessionStatsTableView({
  allHaveDemo,
  entries,
  expandedPlayerId,
  onToggleExpandedPlayer,
}: SessionStatsTableViewProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Stats
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] text-text-dim">
              <th className="py-1 text-left font-normal">Player</th>
              <th className="px-2 py-1 text-center font-normal">
                Session Score
              </th>
              <th className="px-2 py-1 text-center font-normal">Impact</th>
              {allHaveDemo && (
                <>
                  <th className="px-2 py-1 text-center font-normal">RTG</th>
                  <th className="px-2 py-1 text-center font-normal">RWS</th>
                </>
              )}
              <th className="px-2 py-1 text-center font-normal">K/D</th>
              <th className="px-2 py-1 text-center font-normal">ADR</th>
              {allHaveDemo && (
                <th className="px-2 py-1 text-center font-normal">KAST%</th>
              )}
              <th className="px-2 py-1 text-center font-normal">HS%</th>
              {allHaveDemo && (
                <>
                  <th className="px-2 py-1 text-center font-normal">TK</th>
                  <th className="px-2 py-1 text-center font-normal">UD</th>
                  <th className="px-2 py-1 text-center font-normal">Entry%</th>
                </>
              )}
              <th className="px-2 py-1 text-center font-normal">K/R</th>
              <th className="px-2 py-1 text-center font-normal">MVP</th>
              <th className="px-2 py-1 text-center font-normal">GP</th>
              <th className="px-2 py-1 text-center font-normal">W</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e.faceitId}>
                <tr className="border-border border-t">
                  <td className="py-1.5 font-semibold text-text">
                    <div>{e.nickname}</div>
                    {e.scoreBreakdown ? (
                      <button
                        aria-controls={`session-breakdown-${e.faceitId}`}
                        aria-expanded={expandedPlayerId === e.faceitId}
                        className="mt-1 text-[10px] text-text-dim uppercase tracking-wider hover:text-text"
                        onClick={() => onToggleExpandedPlayer(e.faceitId)}
                        type="button"
                      >
                        {expandedPlayerId === e.faceitId
                          ? "Hide score breakdown"
                          : "Score breakdown"}
                      </button>
                    ) : null}
                  </td>
                  <td className="px-2 text-center font-bold text-accent">
                    {(e.sessionScore ?? e.avgImpact).toFixed(1)}
                  </td>
                  <td className="px-2 text-center font-bold text-accent">
                    {e.avgImpact.toFixed(1)}
                  </td>
                  {allHaveDemo && (
                    <>
                      <td
                        className={`px-2 text-center font-bold ${ratingColor(e.avgRating ?? 0)}`}
                      >
                        {(e.avgRating ?? 0).toFixed(2)}
                      </td>
                      <td className="px-2 text-center text-text-muted">
                        {(e.avgRws ?? 0).toFixed(1)}
                      </td>
                    </>
                  )}
                  <td
                    className={`px-2 text-center font-bold ${kdColor(e.avgKd)}`}
                  >
                    {e.avgKd.toFixed(2)}
                  </td>
                  <td className="px-2 text-center text-text-muted">
                    {Math.round(e.avgAdr)}
                  </td>
                  {allHaveDemo && (
                    <td className="px-2 text-center text-text-muted">
                      {(e.avgKast ?? 0).toFixed(0)}%
                    </td>
                  )}
                  <td className="px-2 text-center text-text-muted">
                    {Math.round(e.avgHsPercent)}%
                  </td>
                  {allHaveDemo && (
                    <>
                      <td className="px-2 text-center text-text-muted">
                        {(e.avgTradeKills ?? 0).toFixed(1)}
                      </td>
                      <td className="px-2 text-center text-text-muted">
                        {Math.round(e.avgUtilityDamage ?? 0)}
                      </td>
                      <td className="px-2 text-center text-text-muted">
                        {((e.avgEntryRate ?? 0) * 100).toFixed(0)}%
                      </td>
                    </>
                  )}
                  <td className="px-2 text-center text-text-muted">
                    {e.avgKrRatio.toFixed(2)}
                  </td>
                  <td className="px-2 text-center text-text-muted">
                    {e.totalMvps}
                  </td>
                  <td className="px-2 text-center text-text-muted">
                    {e.gamesPlayed}
                  </td>
                  <td className="px-2 text-center text-accent">{e.wins}</td>
                </tr>
                {e.scoreBreakdown && expandedPlayerId === e.faceitId ? (
                  <tr
                    className="border-border/60 border-t"
                    key={`${e.faceitId}-details`}
                  >
                    <td
                      className="bg-bg-elevated/40 px-3 py-2"
                      colSpan={allHaveDemo ? 16 : 10}
                    >
                      <div
                        className="mt-0"
                        id={`session-breakdown-${e.faceitId}`}
                      >
                        <PlayerSessionBreakdown
                          bestMapId={e.bestMapId}
                          breakdown={e.scoreBreakdown}
                          worstMapId={e.worstMapId}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
