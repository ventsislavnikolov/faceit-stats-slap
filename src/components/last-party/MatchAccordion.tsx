import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getBanterLine } from "~/lib/banter";
import { MAP_COLORS, mapDisplayName } from "~/lib/last-party";
import type {
  DemoMatchAnalytics,
  MatchPlayerStats,
  PlayerHistoryMatch,
} from "~/lib/types";

interface MatchAccordionProps {
  demoMatches: Record<string, DemoMatchAnalytics>;
  matches: PlayerHistoryMatch[];
  matchStats: Record<string, MatchPlayerStats[]>;
  partyMemberIds: string[];
}

export function MatchAccordion({
  matches,
  matchStats,
  demoMatches,
  partyMemberIds,
}: MatchAccordionProps) {
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const partySet = new Set(partyMemberIds);

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Matches
      </div>
      <div className="flex flex-col gap-1">
        {matches.map((match) => {
          const isOpen = openMatchId === match.matchId;
          const players = (matchStats[match.matchId] ?? [])
            .filter((p) => partySet.has(p.playerId))
            .sort((a, b) => b.kills - a.kills);
          const hasDemoData = match.matchId in demoMatches;
          const demoPlayers = hasDemoData
            ? demoMatches[match.matchId].players
            : [];

          const topFragger = players[0];
          const bottomFragger =
            players.length > 1 ? players[players.length - 1] : null;

          return (
            <div
              className="rounded border border-border bg-bg-card"
              key={match.matchId}
            >
              <button
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs"
                onClick={() => setOpenMatchId(isOpen ? null : match.matchId)}
                type="button"
              >
                <div
                  className={`h-2 w-2 rounded-full ${match.result ? "bg-accent" : "bg-error"}`}
                />
                <div
                  className={`rounded px-1.5 py-0.5 font-bold text-[10px] text-bg ${MAP_COLORS[match.map] ?? "bg-text-dim"}`}
                >
                  {mapDisplayName(match.map)}
                </div>
                <span className="font-bold text-text">{match.score}</span>
                {hasDemoData && (
                  <span className="text-[9px] text-accent">DEMO</span>
                )}
                <span className="ml-auto text-[10px] text-text-dim">
                  {isOpen ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {isOpen && (
                <div className="border-border border-t px-3 pt-2 pb-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[9px] text-text-dim">
                          <th className="py-1 text-left font-normal">Player</th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            K
                          </th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            D
                          </th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            A
                          </th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            K/D
                          </th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            ADR
                          </th>
                          <th className="px-1.5 py-1 text-center font-normal">
                            HS%
                          </th>
                          {hasDemoData && (
                            <>
                              <th className="px-1.5 py-1 text-center font-normal">
                                RTG
                              </th>
                              <th className="px-1.5 py-1 text-center font-normal">
                                RWS
                              </th>
                              <th className="px-1.5 py-1 text-center font-normal">
                                KAST
                              </th>
                              <th className="px-1.5 py-1 text-center font-normal">
                                TK
                              </th>
                              <th className="px-1.5 py-1 text-center font-normal">
                                UD
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((p) => {
                          const dp = demoPlayers.find(
                            (d) =>
                              d.playerId === p.playerId ||
                              d.nickname.toLowerCase() ===
                                p.nickname.toLowerCase()
                          );
                          return (
                            <tr
                              className="border-border border-t"
                              key={p.playerId}
                            >
                              <td className="py-1 font-semibold text-text">
                                {p.nickname}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">
                                {p.kills}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">
                                {p.deaths}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">
                                {p.assists}
                              </td>
                              <td
                                className={`px-1.5 text-center font-bold ${p.kdRatio >= 1 ? "text-accent" : "text-error/70"}`}
                              >
                                {p.kdRatio.toFixed(2)}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">
                                {Math.round(p.adr)}
                              </td>
                              <td className="px-1.5 text-center text-text-muted">
                                {p.hsPercent}%
                              </td>
                              {hasDemoData && (
                                <>
                                  <td
                                    className={`px-1.5 text-center font-bold ${dp?.rating ? (dp.rating >= 1.2 ? "text-yellow-400" : dp.rating >= 1.0 ? "text-accent" : dp.rating >= 0.8 ? "text-orange-400" : "text-error") : "text-text-dim"}`}
                                  >
                                    {dp?.rating?.toFixed(2) ?? "-"}
                                  </td>
                                  <td className="px-1.5 text-center text-text-muted">
                                    {dp?.rws?.toFixed(1) ?? "-"}
                                  </td>
                                  <td className="px-1.5 text-center text-text-muted">
                                    {dp?.kastPercent
                                      ? `${dp.kastPercent.toFixed(0)}%`
                                      : "-"}
                                  </td>
                                  <td className="px-1.5 text-center text-text-muted">
                                    {dp?.tradeKills ?? "-"}
                                  </td>
                                  <td className="px-1.5 text-center text-text-muted">
                                    {dp?.utilityDamage ?? "-"}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {topFragger && bottomFragger && (
                    <div className="mt-2 border-border border-t pt-2 text-center">
                      <span className="text-[11px] text-text-muted italic">
                        {getBanterLine(
                          "carry",
                          topFragger.nickname,
                          match.matchId
                        )}
                        {". "}
                        {getBanterLine(
                          "roast",
                          bottomFragger.nickname,
                          match.matchId
                        )}
                        {"."}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 text-center">
                    <Link
                      className="text-[10px] text-accent hover:underline"
                      params={{ matchId: match.matchId }}
                      to="/match/$matchId"
                    >
                      View full match details →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
