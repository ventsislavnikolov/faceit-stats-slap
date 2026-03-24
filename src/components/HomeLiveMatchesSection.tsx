import type { LiveMatch } from "~/lib/types";
import { getTrackedWebhookPlayerIds } from "~/lib/faceit-webhooks";
import { LiveMatchCard } from "./LiveMatchCard";
import { useLiveMatches } from "~/hooks/useLiveMatches";

interface HomeLiveMatchesSectionProps {
  authResolved: boolean;
  bettingContextReady: boolean;
  userId?: string | null;
  userCoins?: number;
}

export function HomeLiveMatchesSection({
  authResolved,
  bettingContextReady,
  userId,
  userCoins,
}: HomeLiveMatchesSectionProps) {
  const trackedPlayerIds = getTrackedWebhookPlayerIds();
  const { data: matches = [], isLoading, isError } = useLiveMatches(trackedPlayerIds);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-accent animate-pulse">
        Loading live matches...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-sm text-error">
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
          <div className="text-[10px] uppercase tracking-wider text-text-dim">
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
            key={match.matchId}
            match={match}
            authResolved={authResolved}
            bettingContextReady={bettingContextReady}
            userId={userId ?? null}
            userCoins={userCoins ?? 0}
          />
        ))}
      </div>
    </section>
  );
}
