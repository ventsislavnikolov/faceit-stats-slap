import { usePropPools } from "~/hooks/usePropPools";
import { useUserPropBetsForMatch } from "~/hooks/useUserPropBetsForMatch";
import type { PropPool } from "~/lib/types";
import { BetCard } from "./BetCard";

interface PropBetCardsProps {
  matchId: string;
  seasonId: string;
  userCoins: number;
  userId: string | null;
}

function shouldRenderLiveProp(
  prop: PropPool,
  hasExistingBet: boolean
): boolean {
  return prop.status === "open" || hasExistingBet;
}

export function PropBetCards({
  matchId,
  seasonId,
  userCoins,
  userId,
}: PropBetCardsProps) {
  const { data: propPools = [] } = usePropPools(matchId);
  const { data: userPropBets = [] } = useUserPropBetsForMatch(matchId, userId);

  if (!propPools.length) {
    return null;
  }

  const userPropBetsById = new Map(
    userPropBets
      .filter((bet) => bet.propPoolId)
      .map((bet) => [bet.propPoolId as string, bet])
  );

  const visibleProps = propPools.filter((prop) =>
    shouldRenderLiveProp(prop, userPropBetsById.has(prop.id))
  );

  if (!visibleProps.length) {
    return null;
  }

  return (
    <>
      {visibleProps.map((prop) => {
        const existingBet = userPropBetsById.get(prop.id) ?? null;
        const winningSide =
          prop.outcome == null ? null : prop.outcome ? "yes" : "no";

        return (
          <BetCard
            closesAt={prop.closesAt}
            existingBet={
              existingBet
                ? {
                    side: existingBet.side,
                    amount: existingBet.amount,
                    payout: existingBet.payout,
                  }
                : null
            }
            id={prop.id}
            key={prop.id}
            label={prop.description}
            seasonId={seasonId}
            side1={{ label: "Yes", pool: prop.yesPool }}
            side2={{ label: "No", pool: prop.noPool }}
            status={prop.status}
            sublabel={`${prop.playerNickname} - ${prop.statKey}`}
            type="prop"
            userCoins={userCoins}
            userId={userId}
            winningTeam={winningSide}
          />
        );
      })}
    </>
  );
}
