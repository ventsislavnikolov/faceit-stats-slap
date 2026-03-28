import { useSeasonCoinBalance } from "~/hooks/useSeasonCoinBalance";

interface CoinBalanceProps {
  seasonId: string | null;
  userId: string;
}

export function CoinBalance({ seasonId, userId }: CoinBalanceProps) {
  const { data: coins } = useSeasonCoinBalance(seasonId, userId);

  if (!seasonId) {
    return (
      <span className="text-text-muted text-xs">
        🪙 <span className="font-bold text-text">&mdash;</span>
      </span>
    );
  }

  if (coins === undefined) {
    return null;
  }

  return (
    <span className="text-text-muted text-xs">
      🪙 <span className="font-bold text-text">{coins.toLocaleString()}</span>
    </span>
  );
}
