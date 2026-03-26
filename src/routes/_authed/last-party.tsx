import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LastPartyHeader } from "~/components/last-party/LastPartyHeader";
import { MapDistribution } from "~/components/last-party/MapDistribution";
import { MatchAccordion } from "~/components/last-party/MatchAccordion";
import { PartyAwards } from "~/components/last-party/PartyAwards";
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

function LastPartyPage() {
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
            <div className="animate-pulse py-8 text-center text-accent">
              Loading party session...
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
