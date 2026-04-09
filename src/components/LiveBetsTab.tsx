import { BetCard } from "~/components/BetCard";
import { PropBetCards } from "~/components/PropBetCards";
import { useBettingPool } from "~/hooks/useBettingPool";
import type { LiveMatch } from "~/lib/types";

interface LiveBetsTabProps {
  liveMatches: LiveMatch[];
  seasonId: string;
  userCoins: number;
  userId: string | null;
}

interface MatchBetsProps {
  match: LiveMatch;
  seasonId: string;
  userCoins: number;
  userId: string | null;
}

function MatchBets({ match, seasonId, userCoins, userId }: MatchBetsProps) {
  const { data } = useBettingPool(match.matchId, userId);
  const pool = data?.pool ?? null;
  const userBet = data?.userBet ?? null;

  const team1Name = pool?.team1Name ?? match.teams.faction1.name;
  const team2Name = pool?.team2Name ?? match.teams.faction2.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider">
        {team1Name} vs {team2Name} &middot; {match.map}
      </div>

      {pool ? (
        <BetCard
          closesAt={pool.closesAt}
          existingBet={
            userBet
              ? {
                  side: userBet.side,
                  amount: userBet.amount,
                  payout: userBet.payout,
                }
              : null
          }
          id={pool.id}
          label={`Match Winner: ${pool.team1Name} vs ${pool.team2Name}`}
          seasonId={seasonId}
          side1={{ label: pool.team1Name, pool: pool.team1Pool }}
          side2={{ label: pool.team2Name, pool: pool.team2Pool }}
          status={pool.status}
          sublabel={match.map}
          type="match"
          userCoins={userCoins}
          userId={userId}
          winningTeam={pool.winningTeam}
        />
      ) : (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 text-text-dim text-xs">
          Betting not available yet for this match.
        </div>
      )}

      <PropBetCards
        matchId={match.matchId}
        seasonId={seasonId}
        userCoins={userCoins}
        userId={userId}
      />
    </div>
  );
}

export function LiveBetsTab({
  liveMatches,
  seasonId,
  userCoins,
  userId,
}: LiveBetsTabProps) {
  if (!liveMatches.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No live matches right now.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {liveMatches.map((match) => (
        <MatchBets
          key={match.matchId}
          match={match}
          seasonId={seasonId}
          userCoins={userCoins}
          userId={userId}
        />
      ))}
    </div>
  );
}
