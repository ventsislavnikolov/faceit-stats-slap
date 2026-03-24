import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useUserBets } from "~/hooks/useUserBets";
import { HistoryMatchesTable } from "~/components/HistoryMatchesTable";
import { PageSectionTabs } from "~/components/PageSectionTabs";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { PlayerViewTabs } from "~/components/PlayerViewTabs";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  getHistoryTabs,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
  normalizeHistoryTab,
  type HistoryTab,
} from "~/lib/history-page";
import { resolvePlayer } from "~/server/friends";

const getClientUserId = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.user.id ?? null;
  });

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
  const [tab, setTab] = useState<HistoryTab>("matches");
  const [userId, setUserId] = useState<string | null>(null);

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
  const { data: userBets = [], isLoading: betsLoading } = useUserBets(userId);

  useEffect(() => {
    getClientUserId().then(setUserId);
  }, []);

  const availableTabs = getHistoryTabs(!!userId);

  useEffect(() => {
    setTab((currentTab) => normalizeHistoryTab(currentTab, !!userId));
  }, [userId]);

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  const updateSearch = (next: {
    player?: string;
    matches?: 20 | 50 | 100;
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
    kdRatio: m.kdRatio,
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
      >
        <PlayerViewTabs
          activeView="history"
          nickname={player?.nickname ?? urlPlayer ?? null}
        />
      </PlayerSearchHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
          <PageSectionTabs
            tabs={availableTabs.map((value) => ({
              key: value,
              label: value === "matches" ? "Match History" : "My Bets",
            }))}
            activeKey={tab}
            onChange={(key) => setTab(key as HistoryTab)}
          />

          {tab === "matches" && (
            <>
              {urlPlayer && !resolveError && (
                <div className="flex flex-wrap items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim">Last</span>
                    <div className="flex gap-1">
                      {getHistoryMatchCountOptions().map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => updateSearch({ matches: count })}
                          className={`rounded px-3 py-1.5 transition-colors ${
                            selectedMatchCount === count
                              ? "bg-accent font-bold text-bg"
                              : "bg-bg-elevated text-text-muted hover:text-text"
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    <span className="text-text-dim">matches</span>
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
            </>
          )}

          {tab === "bets" && (
            <>
              {betsLoading ? (
                <div className="py-8 text-center text-accent animate-pulse">Loading...</div>
              ) : userBets.length === 0 ? (
                <div className="py-12 text-center text-text-dim">No bets placed yet.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[40rem] grid-cols-[1fr_4rem_4rem_5rem_5rem] gap-2 px-3 pb-1 text-[10px] uppercase tracking-wider text-text-dim">
                      <span>Match</span>
                      <span>Side</span>
                      <span className="text-right">Bet</span>
                      <span className="text-right">Payout</span>
                      <span className="text-right">Result</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {userBets.map((bet) => {
                        const statusLabel =
                          bet.pool.status === "RESOLVED"
                            ? bet.payout !== null && bet.payout > bet.amount
                              ? "Won"
                              : "Lost"
                            : bet.pool.status === "REFUNDED"
                              ? "Refunded"
                              : "Pending";
                        const statusColor =
                          statusLabel === "Won"
                            ? "text-accent"
                            : statusLabel === "Lost"
                              ? "text-error"
                              : "text-text-muted";
                        const sideName =
                          bet.side === "team1" ? bet.pool.team1Name : bet.pool.team2Name;

                        return (
                          <div
                            key={bet.id}
                            className="grid min-w-[40rem] grid-cols-[1fr_4rem_4rem_5rem_5rem] items-center gap-2 rounded bg-bg-elevated px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[10px] text-text">
                                {bet.pool.team1Name} vs {bet.pool.team2Name}
                              </div>
                              <div className="text-[10px] text-text-dim">
                                {new Date(bet.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <span className="truncate text-text">{sideName}</span>
                            <span className="text-right text-text-muted">{bet.amount}</span>
                            <span
                              className={`text-right ${
                                bet.payout ? "text-accent" : "text-text-dim"
                              }`}
                            >
                              {bet.payout ?? "—"}
                            </span>
                            <span className={`text-right font-bold ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
