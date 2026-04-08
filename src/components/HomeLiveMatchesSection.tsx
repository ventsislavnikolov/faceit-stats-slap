import { useLiveMatches } from "~/hooks/useLiveMatches";
import { useTrackedPlayers } from "~/hooks/useTrackedPlayers";
import type { LiveMatch } from "~/lib/types";
import { LiveMatchCard } from "./LiveMatchCard";

interface HomeLiveMatchesSectionProps {
  authResolved: boolean;
  bettingContextReady: boolean;
  seasonId?: string | null;
  userCoins?: number;
  userId?: string | null;
}

export function HomeLiveMatchesSection({
  authResolved,
  bettingContextReady,
  seasonId,
  userId,
  userCoins,
}: HomeLiveMatchesSectionProps) {
  const { data: trackedPlayers = [], isLoading: trackedPlayersLoading } =
    useTrackedPlayers();
  const trackedPlayerIds = trackedPlayers.map((player) => player.faceitId);
  const {
    data: matches = [],
    isLoading,
    isError,
  } = useLiveMatches(trackedPlayerIds);

  if (trackedPlayersLoading || isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            className="rounded-lg border border-border bg-bg-card p-4"
            key={i}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-10 animate-pulse rounded bg-border" />
              <div className="h-4 w-20 animate-pulse rounded bg-border" />
            </div>
            <div className="mb-3 flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <div className="h-3 w-20 animate-pulse rounded bg-border" />
                <div className="h-8 w-8 animate-pulse rounded bg-border" />
              </div>
              <div className="text-lg text-text-dim">vs</div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-3 w-20 animate-pulse rounded bg-border" />
                <div className="h-8 w-8 animate-pulse rounded bg-border" />
              </div>
            </div>
            <div className="border-border border-t pt-3">
              <div className="mb-2 flex justify-between">
                <div className="h-2 w-16 animate-pulse rounded bg-border" />
                <div className="h-2 w-20 animate-pulse rounded bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 animate-pulse rounded bg-bg-elevated" />
                <div className="h-10 animate-pulse rounded bg-bg-elevated" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load live matches.
      </div>
    );
  }

  if (!matches.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No tracked players are live right now.
      </div>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Live Matches
          </div>
          <div className="text-sm text-text-muted">
            Betting is enabled on the live cards below.
          </div>
        </div>
        <div className="text-[10px] text-text-dim">
          Tracked players: {trackedPlayerIds.length}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {matches.map((match: LiveMatch) => (
          <LiveMatchCard
            authResolved={authResolved}
            bettingContextReady={bettingContextReady}
            key={match.matchId}
            match={match}
            seasonId={seasonId}
            userCoins={userCoins ?? 0}
            userId={userId ?? null}
          />
        ))}
      </div>
    </section>
  );
}
