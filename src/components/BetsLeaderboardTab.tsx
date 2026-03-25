import { useLeaderboard } from "~/hooks/useLeaderboard";
import { sortBettingLeaderboardEntries } from "~/lib/betting-stats";
import type { BettingLeaderboardEntry } from "~/lib/types";

interface BetsLeaderboardTabProps {
  userId?: string | null;
}

function hasBettingActivity(entries: BettingLeaderboardEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.betsPlaced > 0 ||
      entry.betsWon > 0 ||
      entry.resolvedBets > 0 ||
      entry.totalWagered > 0 ||
      entry.totalReturned > 0 ||
      entry.netProfit !== 0
  );
}

export function BetsLeaderboardTab({ userId }: BetsLeaderboardTabProps) {
  const { data = [], isLoading, isError } = useLeaderboard();
  const entries = sortBettingLeaderboardEntries(data);

  if (isLoading) {
    return (
      <div className="animate-pulse py-8 text-center text-accent">
        Loading...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load betting leaderboard.
      </div>
    );
  }

  if (!(entries.length && hasBettingActivity(entries))) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No resolved bets yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
        style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem 5rem 5rem" }}
      >
        <span>#</span>
        <span>Player</span>
        <span className="text-right">P/L</span>
        <span className="text-right">Coins</span>
        <span className="text-right">Placed</span>
        <span className="text-right">Won</span>
        <span className="text-right">Win %</span>
      </div>

      {entries.map((entry, index) => {
        const isCurrentUser = !!userId && entry.userId === userId;
        return (
          <div
            className={`grid gap-2 rounded px-3 py-2 text-sm ${
              isCurrentUser
                ? "border-accent border-l-2 bg-accent/10"
                : "bg-bg-elevated"
            }`}
            key={entry.userId}
            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem 5rem 5rem" }}
          >
            <span className="font-bold text-text-dim text-xs">{index + 1}</span>
            <span
              className={`truncate font-bold ${isCurrentUser ? "text-accent" : "text-text"}`}
            >
              {isCurrentUser ? "You" : entry.nickname}
            </span>
            <span
              className={`text-right font-semibold text-xs ${
                entry.netProfit > 0
                  ? "text-accent"
                  : entry.netProfit < 0
                    ? "text-error"
                    : "text-text-muted"
              }`}
            >
              {entry.netProfit > 0 ? "+" : ""}
              {entry.netProfit}
            </span>
            <span className="text-right text-text-muted text-xs">
              {entry.coins}
            </span>
            <span className="text-right text-text-muted text-xs">
              {entry.betsPlaced}
            </span>
            <span className="text-right text-text-muted text-xs">
              {entry.betsWon}
            </span>
            <span className="text-right text-text-muted text-xs">
              {entry.winRate}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
