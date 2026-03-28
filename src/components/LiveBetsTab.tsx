import { BetCard } from "~/components/BetCard";
import { useBettingPool } from "~/hooks/useBettingPool";
import { usePropPools } from "~/hooks/usePropPools";
import type { LiveMatch, PropPool } from "~/lib/types";

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

function PropBetCards({
  matchId,
  seasonId,
  userCoins,
  userId,
}: {
  matchId: string;
  seasonId: string;
  userCoins: number;
  userId: string | null;
}) {
  const { data: propPools = [] } = usePropPools(matchId);

  if (!propPools.length) {
    return null;
  }

  return (
    <>
      {propPools.map((prop: PropPool) => (
        <BetCard
          closesAt={prop.closesAt}
          id={prop.id}
          key={prop.id}
          label={prop.description}
          seasonId={seasonId}
          side1={{ label: "Yes", pool: prop.yesPool }}
          side2={{ label: "No", pool: prop.noPool }}
          status={prop.status}
          sublabel={`${prop.playerNickname} - ${prop.statKey} ${prop.outcome === null ? "" : prop.outcome ? "HIT" : "MISS"}`}
          type="prop"
          userCoins={userCoins}
          userId={userId}
        />
      ))}
    </>
  );
}

function MatchBets({ match, seasonId, userCoins, userId }: MatchBetsProps) {
  const { data } = useBettingPool(match.matchId, userId);
  const pool = data?.pool ?? null;
  const userBet = data?.userBet ?? null;

  const team1Name = match.teams.faction1.name;
  const team2Name = match.teams.faction2.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider">
        {team1Name} vs {team2Name} &middot; {match.map}
      </div>

      {pool && (
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
          label={`${pool.team1Name} vs ${pool.team2Name}`}
          seasonId={seasonId}
          side1={{ label: pool.team1Name, pool: pool.team1Pool }}
          side2={{ label: pool.team2Name, pool: pool.team2Pool }}
          status={pool.status}
          type="match"
          userCoins={userCoins}
          userId={userId}
        />
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
