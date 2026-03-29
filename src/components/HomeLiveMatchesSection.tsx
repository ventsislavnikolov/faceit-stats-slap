import { useLiveMatches } from "~/hooks/useLiveMatches";
import { getTrackedWebhookPlayerIds } from "~/lib/faceit-webhooks";
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
  const trackedPlayerIds = getTrackedWebhookPlayerIds();
  const {
    data: matches = [],
    isLoading,
    isError,
  } = useLiveMatches(trackedPlayerIds);

  if (isLoading) {
    return (
      <div className="animate-pulse py-8 text-center text-accent">
        Loading live matches...
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
