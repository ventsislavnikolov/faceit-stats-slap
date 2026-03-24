import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { HistoryMatchesTable } from "~/components/HistoryMatchesTable";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  type HistoryMatchCount,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
} from "~/lib/history-page";
import { resolvePlayer } from "~/server/friends";

export const Route = createFileRoute("/_authed/history")({
  validateSearch: (search: Record<string, unknown>) => ({
    player: typeof search.player === "string" && search.player.length > 0
      ? search.player
      : undefined,
    matches: normalizeHistoryMatchCount(search.matches),
    queue: normalizeHistoryQueueFilter(search.queue),
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const { player: urlPlayer, matches: selectedMatchCount, queue: selectedQueue } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");

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

  const { data: stats = [], isLoading } = usePlayerStats(
    player?.faceitId ?? null,
    selectedMatchCount,
    selectedQueue
  );

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  const updateSearch = (next: {
    player?: string;
    matches?: HistoryMatchCount;
    queue?: "all" | "solo" | "party";
  }) => {
    navigate({
      to: "/history",
      search: {
        player: next.player ?? urlPlayer,
        matches: next.matches ?? selectedMatchCount,
        queue: next.queue ?? selectedQueue,
      },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) return;

    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    updateSearch({ player: target.value });
  };

  const matches = stats.map((m: any) => ({
    nickname: m.nickname,
    matchId: m.matchId,
    map: m.map,
    score: m.score,
    kills: m.kills,
    kdRatio: m.kdRatio,
    krRatio: m.krRatio,
    adr: m.adr,
    hsPercent: m.hsPercent,
    result: m.result,
    eloDelta: null,
    queueBucket: m.queueBucket,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        value={input}
        onValueChange={setInput}
        onSubmit={handleSearch}
        placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
        status={player ? (
          <span>
            Showing history for <span className="text-accent">{player.nickname}</span>
          </span>
        ) : null}
        error={resolveError ? "Player not found." : null}
      />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {urlPlayer && !resolveError && (
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-text-dim">Last</span>
                <div className="flex gap-1">
                  {getHistoryMatchCountOptions().map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSearch({ matches: option.value })}
                      className={`rounded px-3 py-1.5 transition-colors ${
                        selectedMatchCount === option.value
                          ? "bg-accent font-bold text-bg"
                          : "bg-bg-elevated text-text-muted hover:text-text"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="text-text-dim">games</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-text-dim">Queue</span>
                <div className="flex gap-1">
                  {getHistoryQueueOptions().map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSearch({ queue: option.value })}
                      className={`rounded px-3 py-1.5 transition-colors ${
                        selectedQueue === option.value
                          ? "bg-accent font-bold text-bg"
                          : "bg-bg-elevated text-text-muted hover:text-text"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {urlPlayer && !resolveError && (
            <div className="text-[10px] text-text-dim">
              Party means the player plus at least 2 known FACEIT friends in the same
              match.
            </div>
          )}

          {resolving || isLoading ? (
            <div className="py-8 text-center text-accent animate-pulse">Loading...</div>
          ) : player ? (
            <HistoryMatchesTable matches={matches} />
          ) : (
            <div className="py-12 text-center text-text-dim">
              Enter a nickname or UUID to view match history
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
