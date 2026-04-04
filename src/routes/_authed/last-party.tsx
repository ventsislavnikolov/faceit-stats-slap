import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LastPartyHeader } from "~/components/last-party/LastPartyHeader";
import { MapDistribution } from "~/components/last-party/MapDistribution";
import { MatchAccordion } from "~/components/last-party/MatchAccordion";
import { PartyAwards } from "~/components/last-party/PartyAwards";
import { SessionPodium } from "~/components/last-party/SessionPodium";
import { SessionRivalryCards } from "~/components/last-party/SessionRivalryCards";
import { SessionAnalyst } from "~/components/last-party/SessionAnalyst";
import { SessionStatsTable } from "~/components/last-party/SessionStatsTable";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { usePartySession } from "~/hooks/usePartySession";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import { getYesterdayDateString } from "~/lib/time";
import { resolvePlayer } from "~/server/friends";

export const Route = createFileRoute("/_authed/last-party")({
  validateSearch: (search: Record<string, unknown>) => ({
    player:
      typeof search.player === "string" && search.player.length > 0
        ? search.player
        : undefined,
    date:
      typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
  }),
  component: LastPartyPage,
});

export function LastPartyPage() {
  const navigate = useNavigate();
  const { player: urlPlayer, date: urlDate } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");
  const [dateInput, setDateInput] = useState(
    urlDate ?? getYesterdayDateString()
  );

  const {
    data: player,
    isLoading: resolving,
    isError: resolveError,
  } = useQuery({
    queryKey: ["resolve-player", urlPlayer],
    queryFn: () => resolvePlayer({ data: urlPlayer! }),
    enabled: !!urlPlayer,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const effectiveDate = urlDate ?? getYesterdayDateString();

  const { data: session, isLoading: sessionLoading } = usePartySession(
    player?.faceitId ?? null,
    effectiveDate
  );

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  useEffect(() => {
    setDateInput(urlDate ?? getYesterdayDateString());
  }, [urlDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) {
      return;
    }
    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }
    navigate({
      to: "/last-party",
      search: { player: target.value, date: dateInput },
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateInput(newDate);
    if (urlPlayer) {
      navigate({
        to: "/last-party",
        search: { player: urlPlayer, date: newDate },
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        error={resolveError ? "Player not found." : null}
        onSubmit={handleSearch}
        onValueChange={setInput}
        placeholder="FACEIT nickname, profile link, or player UUID..."
        value={input}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          <div className="flex items-center gap-3 text-xs">
            <label className="text-text-dim" htmlFor="party-date">
              Date
            </label>
            <input
              className="rounded border border-border bg-bg-elevated px-3 py-1.5 text-text"
              id="party-date"
              max={getYesterdayDateString()}
              onChange={handleDateChange}
              type="date"
              value={dateInput}
            />
          </div>

          {(resolving || sessionLoading) && urlPlayer && (
            <div className="flex flex-col gap-6">
              {/* LastPartyHeader skeleton */}
              <div className="rounded border border-border bg-bg-card p-4">
                <div className="mb-1 h-2.5 w-20 animate-pulse rounded bg-border" />
                <div className="mb-2 h-5 w-56 animate-pulse rounded bg-border" />
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-14 animate-pulse rounded bg-border" />
                    <div className="h-3 w-4 animate-pulse rounded bg-border" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-6 animate-pulse rounded bg-accent/30" />
                    <div className="h-3 w-3 animate-pulse rounded bg-border" />
                    <div className="h-3 w-6 animate-pulse rounded bg-error/30" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-10 animate-pulse rounded bg-border" />
                    <div className="h-3 w-8 animate-pulse rounded bg-border" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-border" />
                    <div className="h-3 w-6 animate-pulse rounded bg-border" />
                  </div>
                </div>
              </div>

              {/* Session podium skeleton */}
              <div data-testid="last-party-podium-skeleton">
                <div className="mb-3 h-2.5 w-20 animate-pulse rounded bg-border" />
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      className={`rounded border bg-bg-card p-3 ${i === 0 ? "border-accent/30 bg-accent/5" : "border-border"}`}
                      key={i}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 animate-pulse rounded-full bg-border" />
                          <div className="flex flex-col gap-1">
                            <div className="h-2 w-12 animate-pulse rounded bg-border" />
                            <div className="h-4 w-20 animate-pulse rounded bg-border" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="h-5 w-12 animate-pulse rounded bg-border" />
                          <div className="h-2.5 w-8 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                      <div className="mt-3 h-6 w-full animate-pulse rounded border border-border bg-bg-elevated" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Rivalry cards skeleton */}
              <div data-testid="last-party-rivalry-skeleton">
                <div className="mb-3 h-2.5 w-24 animate-pulse rounded bg-border" />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      className="rounded border border-border bg-bg-card p-3"
                      key={i}
                    >
                      <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
                      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-border" />
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <div className="h-4 w-20 animate-pulse rounded-full bg-border" />
                        <div className="h-4 w-24 animate-pulse rounded-full bg-border" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Awards skeleton */}
              <div>
                <div className="mb-3 h-2.5 w-14 animate-pulse rounded bg-border" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      className={`rounded border bg-bg-card p-3 ${
                        i === 0
                          ? "border-accent/30 bg-accent/5"
                          : i === 1
                            ? "border-error/20 bg-error/5"
                            : "border-border"
                      }`}
                      key={i}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 animate-pulse rounded bg-border" />
                        <div className="flex flex-col gap-1">
                          <div className="h-2 w-20 animate-pulse rounded bg-border" />
                          <div className="h-3.5 w-24 animate-pulse rounded bg-border" />
                          <div className="h-2.5 w-14 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session Stats table skeleton */}
              <div>
                <div className="mb-3 h-2.5 w-24 animate-pulse rounded bg-border" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <th className="px-2 py-1" key={i}>
                            <div className="mx-auto h-2 w-8 animate-pulse rounded bg-border" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr className="border-border border-t" key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td className="px-2 py-1.5" key={j}>
                              <div
                                className={`mx-auto h-3 animate-pulse rounded bg-border ${j === 0 ? "w-16" : "w-8"}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Map distribution skeleton */}
              <div>
                <div className="mb-3 h-2.5 w-10 animate-pulse rounded bg-border" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      className="flex items-center gap-2 rounded border border-border bg-bg-card px-3 py-2"
                      key={i}
                    >
                      <div className="h-3 w-3 animate-pulse rounded-sm bg-border" />
                      <div className="h-3 w-14 animate-pulse rounded bg-border" />
                      <div className="h-2.5 w-5 animate-pulse rounded bg-border" />
                      <div className="h-2.5 w-5 animate-pulse rounded bg-accent/30" />
                      <div className="h-2.5 w-4 animate-pulse rounded bg-error/30" />
                      <div className="h-2.5 w-6 animate-pulse rounded bg-border" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Matches skeleton */}
              <div>
                <div className="mb-3 h-2.5 w-16 animate-pulse rounded bg-border" />
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      className="flex items-center gap-3 rounded border border-border bg-bg-card px-3 py-2"
                      key={i}
                    >
                      <div
                        className={`h-2 w-2 animate-pulse rounded-full ${i % 2 === 0 ? "bg-accent/40" : "bg-error/40"}`}
                      />
                      <div className="h-4 w-14 animate-pulse rounded bg-border" />
                      <div className="h-3 w-12 animate-pulse rounded bg-border" />
                      <div className="h-2.5 w-10 animate-pulse rounded bg-accent/20" />
                      <div className="ml-auto h-2.5 w-3 animate-pulse rounded bg-border" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {session && session.matches.length === 0 && (
            <div className="py-12 text-center text-text-dim">
              No party matches found on this date. Try selecting a different
              day.
            </div>
          )}

          {!(urlPlayer || resolving) && (
            <div className="py-12 text-center text-text-dim">
              Enter a nickname or UUID to view party session recap.
            </div>
          )}

          {session && session.matches.length > 0 && (
            <>
              <LastPartyHeader
                date={session.date}
                lossCount={session.lossCount}
                matches={session.matches}
                totalHoursPlayed={session.totalHoursPlayed}
                winCount={session.winCount}
              />
              {session.rivalries?.podium?.length ? (
                <SessionPodium entries={session.rivalries.podium} />
              ) : null}
              {session.rivalries?.rivalryCards?.length ? (
                <SessionRivalryCards cards={session.rivalries.rivalryCards} />
              ) : null}
              <PartyAwards awards={session.awards} />
              <SessionStatsTable
                allHaveDemo={session.allHaveDemo}
                stats={session.aggregateStats}
              />
              <MapDistribution maps={session.mapDistribution} />
              <MatchAccordion
                demoMatches={session.demoMatches}
                eloMap={session.eloMap}
                matches={session.matches}
                matchStats={session.matchStats}
                partyMemberIds={session.partyMembers.map((p) => p.faceitId)}
              />
              {session.allHaveDemo && (
                <SessionAnalyst stats={session.aggregateStats} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
