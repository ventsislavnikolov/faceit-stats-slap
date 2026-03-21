import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useFriends } from "~/hooks/useFriends";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useUserBets } from "~/hooks/useUserBets";
import { RecentMatches } from "~/components/RecentMatches";

const requireAuth = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" as any });
  });

const getClientUserId = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.user.id ?? null;
  });

export const Route = createFileRoute("/_authed/history")({
  beforeLoad: () => requireAuth(),
  component: HistoryPage,
});

type Tab = "matches" | "bets";

function HistoryPage() {
  const { data: friends = [] } = useFriends();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matches");
  const [userId, setUserId] = useState<string | null>(null);
  const { data: stats = [], isLoading } = usePlayerStats(selectedId);
  const { data: userBets = [], isLoading: betsLoading } = useUserBets(userId);

  useEffect(() => {
    getClientUserId().then(setUserId);
  }, []);

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
        {(["matches", "bets"] as Tab[]).map((t) => (
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
          <div className="flex gap-2 flex-wrap mb-6">
            {friends.map((f) => (
              <button
                key={f.faceitId}
                onClick={() => setSelectedId(f.faceitId)}
                className={`text-xs px-3 py-1.5 rounded ${
                  selectedId === f.faceitId
                    ? "bg-accent text-bg font-bold"
                    : "bg-bg-elevated text-text-muted hover:text-accent"
                }`}
              >
                {f.nickname}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="text-accent animate-pulse text-center py-8">Loading...</div>
          ) : selectedId ? (
            <RecentMatches matches={matches} />
          ) : (
            <div className="text-text-dim text-center py-12">
              Select a friend to view history
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
