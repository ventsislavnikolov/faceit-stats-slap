import { useLeaderboard } from "~/hooks/useLeaderboard";
import { sortBettingLeaderboardEntries } from "~/lib/betting-stats";

interface BetsLeaderboardTabProps {
  userId?: string | null;
}

export function BetsLeaderboardTab({ userId }: BetsLeaderboardTabProps) {
  const { data = [], isLoading, isError } = useLeaderboard();
  const entries = sortBettingLeaderboardEntries(data);

  if (isLoading) {
    return <div className="py-8 text-center text-accent animate-pulse">Loading...</div>;
  }

  if (isError) {
    return <div className="py-12 text-center text-sm text-error">Failed to load betting leaderboard.</div>;
  }

  if (!entries.length) {
    return <div className="py-12 text-center text-sm text-text-dim">No resolved bets yet.</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid gap-2 px-3 pb-1 text-[10px] uppercase tracking-wider text-text-dim"
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
            key={entry.userId}
            className={`grid gap-2 rounded px-3 py-2 text-sm ${
              isCurrentUser ? "border-l-2 border-accent bg-accent/10" : "bg-bg-elevated"
            }`}
            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem 5rem 5rem" }}
          >
            <span className="text-xs font-bold text-text-dim">{index + 1}</span>
            <span className={`truncate font-bold ${isCurrentUser ? "text-accent" : "text-text"}`}>
              {isCurrentUser ? "You" : entry.nickname}
            </span>
            <span
              className={`text-right text-xs font-semibold ${
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
            <span className="text-right text-xs text-text-muted">{entry.coins}</span>
            <span className="text-right text-xs text-text-muted">{entry.betsPlaced}</span>
            <span className="text-right text-xs text-text-muted">{entry.betsWon}</span>
            <span className="text-right text-xs text-text-muted">{entry.winRate}%</span>
          </div>
        );
      })}
    </div>
  );
}
