import { Skeleton } from "boneyard-js/react";
import { useSeasonLeaderboard } from "~/hooks/useSeasonLeaderboard";
import type { Season } from "~/lib/types";

interface SeasonLeaderboardTabProps {
  loading?: boolean;
  season: Season;
  userId?: string | null;
}

export function SeasonLeaderboardTab({
  season,
  userId,
  loading,
}: SeasonLeaderboardTabProps) {
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useSeasonLeaderboard(season.id);

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load season leaderboard.
      </div>
    );
  }

  if (!(isLoading || (loading ?? false) || entries.length)) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No participants yet.
      </div>
    );
  }

  return (
    <Skeleton
      fallback={
        <div className="flex flex-col gap-1">
          <div
            className="grid gap-2 px-3 pb-1"
            style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="h-2 animate-pulse rounded bg-border" key={i} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="h-9 w-full animate-pulse rounded bg-bg-elevated"
              key={i}
            />
          ))}
        </div>
      }
      loading={isLoading || (loading ?? false)}
      name="season-leaderboard"
    >
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
          <div className="flex flex-col gap-3">
            {season.prizes.map((prize) => (
              <div
                className="relative overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 via-bg-elevated to-accent/5 p-4"
                key={prize.place}
              >
                <div className="flex items-center gap-4">
                  {prize.imageUrl && (
                    <div className="shrink-0">
                      <img
                        alt={prize.skinName ?? prize.description}
                        className="h-24 w-auto object-contain drop-shadow-[0_0_8px_rgba(80,250,123,0.3)]"
                        height={96}
                        src={prize.imageUrl}
                        width={96}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <span className="font-bold text-[10px] text-accent uppercase tracking-wider">
                        1st Place Prize
                      </span>
                    </div>
                    <div className="font-bold text-lg text-text">
                      {prize.skinName ?? prize.description}
                    </div>
                    {prize.wear && (
                      <div className="flex items-center gap-2 text-text-muted text-xs">
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent">
                          {prize.wear}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Skeleton>
  );
}
