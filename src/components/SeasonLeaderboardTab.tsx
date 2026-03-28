import { useSeasonLeaderboard } from "~/hooks/useSeasonLeaderboard";
import type { Season } from "~/lib/types";

interface SeasonLeaderboardTabProps {
  season: Season;
  userId?: string | null;
}

export function SeasonLeaderboardTab({
  season,
  userId,
}: SeasonLeaderboardTabProps) {
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useSeasonLeaderboard(season.id);

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
        Failed to load season leaderboard.
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No participants yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div
          className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
          style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
        >
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Coins</span>
          <span className="text-right">Bets</span>
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
              style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
            >
              <span className="font-bold text-text-dim text-xs">
                {index + 1}
              </span>
              <span
                className={`truncate font-bold ${isCurrentUser ? "text-accent" : "text-text"}`}
              >
                {entry.nickname}
              </span>
              <span className="text-right font-semibold text-text-muted text-xs">
                {entry.coins}
              </span>
              <span className="text-right text-text-muted text-xs">
                {entry.betsPlaced}
              </span>
              <span className="text-right text-text-muted text-xs">
                {entry.winRate}%
              </span>
            </div>
          );
        })}
      </div>

      {season.prizes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Prizes
          </div>
          {season.prizes.map((prize) => (
            <div
              className="flex items-center gap-3 rounded bg-bg-elevated px-3 py-2 text-sm"
              key={prize.place}
            >
              <span className="font-bold text-accent text-xs">
                #{prize.place}
              </span>
              <span className="text-text">{prize.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
