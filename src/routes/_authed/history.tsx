import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useUserBets } from "~/hooks/useUserBets";
import { RecentMatches } from "~/components/RecentMatches";
import { getHistoryTabs, normalizeHistoryTab, type HistoryTab } from "~/lib/history-page";
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
    player: (search.player as string) || undefined,
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { player: urlPlayer } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");
  const [search, setSearch] = useState<string | null>(urlPlayer ?? null);
  const [tab, setTab] = useState<HistoryTab>("matches");
  const [userId, setUserId] = useState<string | null>(null);

  const {
    data: player,
    isLoading: resolving,
    isError: resolveError,
  } = useQuery({
    queryKey: ["resolve-player", search],
    queryFn: () => resolvePlayer({ data: search! }),
    enabled: !!search,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: stats = [], isLoading } = usePlayerStats(player?.faceitId ?? null);
  const { data: userBets = [], isLoading: betsLoading } = useUserBets(userId);

  useEffect(() => {
    getClientUserId().then(setUserId);
  }, []);

  const availableTabs = getHistoryTabs(!!userId);

  useEffect(() => {
    setTab((currentTab) => normalizeHistoryTab(currentTab, !!userId));
  }, [userId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setSearch(trimmed);
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
  }));

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-elevated rounded p-1 w-fit">
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-4 py-1.5 rounded transition-colors ${
              tab === t
                ? "bg-accent text-bg font-bold"
                : "text-text-muted hover:text-accent"
            }`}
          >
            {t === "matches" ? "Match History" : "My Bets"}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        <>
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="FACEIT nickname or UUID"
              className="flex-1 bg-bg-elevated text-text text-xs px-3 py-2 rounded border border-border focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              className="text-xs px-4 py-2 rounded bg-accent text-bg font-bold hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </form>
          {player && (
            <div className="text-xs text-text-muted mb-4">
              Showing history for <span className="text-accent font-bold">{player.nickname}</span>
            </div>
          )}
          {resolveError && (
            <div className="text-error text-xs text-center py-8">Player not found</div>
          )}
          {(resolving || isLoading) ? (
            <div className="text-accent animate-pulse text-center py-8">Loading...</div>
          ) : player ? (
            <RecentMatches matches={matches} />
          ) : (
            <div className="text-text-dim text-center py-12">
              Enter a nickname or UUID to view match history
            </div>
          )}
        </>
      )}

      {tab === "bets" && (
        <div>
          {betsLoading ? (
            <div className="text-accent animate-pulse text-center py-8">Loading...</div>
          ) : userBets.length === 0 ? (
            <div className="text-text-dim text-center py-12">No bets placed yet.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr_4rem_4rem_5rem_5rem] gap-2 text-[10px] text-text-dim uppercase tracking-wider px-3 pb-1">
                <span>Match</span>
                <span>Side</span>
                <span className="text-right">Bet</span>
                <span className="text-right">Payout</span>
                <span className="text-right">Result</span>
              </div>
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
                    className="grid grid-cols-[1fr_4rem_4rem_5rem_5rem] gap-2 items-center px-3 py-2 bg-bg-elevated rounded text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-text truncate text-[10px]">
                        {bet.pool.team1Name} vs {bet.pool.team2Name}
                      </span>
                      <span className="text-text-dim text-[10px]">
                        {new Date(bet.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-text truncate">{sideName}</span>
                    <span className="text-right text-text-muted">{bet.amount}</span>
                    <span className={`text-right ${bet.payout ? "text-accent" : "text-text-dim"}`}>
                      {bet.payout ?? "—"}
                    </span>
                    <span className={`text-right font-bold ${statusColor}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
