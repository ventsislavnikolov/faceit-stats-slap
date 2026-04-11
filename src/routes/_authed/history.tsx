import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Skeleton } from "boneyard-js/react";
import { useEffect, useState } from "react";
import { HistoryMatchesTable } from "~/components/HistoryMatchesTable";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useTrackedPlayerTarget } from "~/hooks/useTrackedPlayerTarget";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  type HistoryMatchCount,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
} from "~/lib/history-page";
import { buildTrackedPlayerSearch } from "~/lib/tracked-route";

export const Route = createFileRoute("/_authed/history")({
  validateSearch: (search: Record<string, unknown>) => ({
    player:
      typeof search.player === "string" && search.player.length > 0
        ? search.player
        : undefined,
    resolvedPlayerId:
      typeof search.resolvedPlayerId === "string" &&
      search.resolvedPlayerId.length > 0
        ? search.resolvedPlayerId
        : undefined,
    matches: normalizeHistoryMatchCount(search.matches),
    queue: normalizeHistoryQueueFilter(search.queue),
  }),
  component: HistoryPage,
});

export function HistoryPage() {
  const navigate = useNavigate();
  const {
    player: urlPlayer,
    resolvedPlayerId,
    matches: selectedMatchCount,
    queue: selectedQueue,
  } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");

  const {
    data: player,
    isLoading: resolving,
    isError: resolveError,
    isTrackedFlow,
  } = useTrackedPlayerTarget({
    page: "history",
    player: urlPlayer,
    resolvedPlayerId,
    matches: selectedMatchCount,
    queue: selectedQueue,
  });

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  useEffect(() => {
    if (
      !(isTrackedFlow && player?.faceitId && urlPlayer) ||
      resolvedPlayerId === player.faceitId
    ) {
      return;
    }

    navigate({
      to: "/history",
      replace: true,
      search: {
        ...buildTrackedPlayerSearch({
          currentPlayer: urlPlayer,
          currentResolvedPlayerId: resolvedPlayerId,
          nextResolvedPlayerId: player.faceitId,
        }),
        matches: selectedMatchCount,
        queue: selectedQueue,
      },
    });
  }, [
    isTrackedFlow,
    navigate,
    player?.faceitId,
    resolvedPlayerId,
    selectedMatchCount,
    selectedQueue,
    urlPlayer,
  ]);

  const { data: stats = [], isLoading } = usePlayerStats(
    player?.faceitId ?? null,
    selectedMatchCount,
    selectedQueue
  );

  const updateSearch = (next: {
    player?: string;
    matches?: HistoryMatchCount;
    queue?: "all" | "solo" | "party";
  }) => {
    const nextPlayer = next.player ?? urlPlayer;
    navigate({
      to: "/history",
      search: {
        ...buildTrackedPlayerSearch({
          currentPlayer: urlPlayer,
          currentResolvedPlayerId: resolvedPlayerId,
          nextPlayer,
        }),
        matches: next.matches ?? selectedMatchCount,
        queue: next.queue ?? selectedQueue,
      },
    });
  };

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
    hasDemoAnalytics: m.hasDemoAnalytics,
  }));
  const hasTrackedPlayerMiss =
    isTrackedFlow && !resolving && !resolveError && !player;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        error={resolveError ? "Player not found." : null}
        onSubmit={handleSearch}
        onValueChange={setInput}
        placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
        value={input}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-dim">Last</span>
              <div className="flex gap-1">
                {getHistoryMatchCountOptions().map((option) => (
                  <button
                    className={`rounded px-3 py-1.5 transition-colors ${
                      selectedMatchCount === option.value
                        ? "bg-accent font-bold text-bg"
                        : "bg-bg-elevated text-text-muted hover:text-text"
                    }`}
                    key={option.value}
                    onClick={() => updateSearch({ matches: option.value })}
                    type="button"
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
                    className={`rounded px-3 py-1.5 transition-colors ${
                      selectedQueue === option.value
                        ? "bg-accent font-bold text-bg"
                        : "bg-bg-elevated text-text-muted hover:text-text"
                    }`}
                    key={option.value}
                    onClick={() => updateSearch({ queue: option.value })}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-text-dim">
            Party means the player plus at least 2 known FACEIT friends in the
            same match.
          </div>

          <Skeleton
            fallback={
              <div className="flex flex-col gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    className="grid min-w-[50rem] gap-2 rounded border-border border-l-2 bg-bg-elevated px-3 py-2"
                    key={i}
                    style={{
                      gridTemplateColumns: "3rem 24rem 2.5rem repeat(7, 5rem)",
                    }}
                  >
                    <div className="h-3 w-8 animate-pulse rounded bg-border" />
                    <div className="h-3 w-20 animate-pulse rounded bg-border" />
                    <div className="mx-auto h-3 w-3 animate-pulse rounded bg-border" />
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div
                        className="ml-auto h-3 w-10 animate-pulse rounded bg-border"
                        key={j}
                      />
                    ))}
                  </div>
                ))}
              </div>
            }
            loading={resolving || isLoading}
            name="history-matches"
          >
            {player ? (
              <HistoryMatchesTable matches={matches} />
            ) : hasTrackedPlayerMiss ? (
              <div className="py-12 text-center text-text-dim">
                No tracked player has matching history for these filters.
              </div>
            ) : (
              <div className="py-12 text-center text-text-dim">
                Enter a nickname or UUID to view match history
              </div>
            )}
          </Skeleton>
        </div>
      </div>
    </div>
  );
}
