import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import { useEffect, useState } from "react";

const getCurrentUserId = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.user.id ?? null;
  });

export const Route = createFileRoute("/_authed/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data: entries = [], isLoading } = useLeaderboard();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-6">Leaderboard</h2>

      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 text-[10px] text-text-dim uppercase tracking-wider px-3 pb-1">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Coins</span>
            <span className="text-right">Bets</span>
            <span className="text-right">Won</span>
            <span className="text-right">Win%</span>
          </div>
          {entries.map((entry, i) => {
            const winRate = entry.betsPlaced > 0
              ? Math.round((entry.betsWon / entry.betsPlaced) * 100)
              : 0;
            const isMe = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className={`grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 items-center px-3 py-2 rounded text-sm ${
                  isMe
                    ? "bg-accent/10 border border-accent/30"
                    : "bg-bg-elevated"
                }`}
              >
                <span className={`text-xs ${i < 3 ? "text-accent font-bold" : "text-text-dim"}`}>
                  {i + 1}
                </span>
                <span className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}>
                  {entry.nickname}
                </span>
                <span className="text-right text-accent font-bold">
                  🪙 {entry.coins.toLocaleString()}
                </span>
                <span className="text-right text-text-muted">{entry.betsPlaced}</span>
                <span className="text-right text-text-muted">{entry.betsWon}</span>
                <span className={`text-right ${winRate >= 50 ? "text-accent" : "text-text-muted"}`}>
                  {entry.betsPlaced > 0 ? `${winRate}%` : "—"}
                </span>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-text-dim text-center py-12 text-sm">
              No players yet — place the first bet!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
