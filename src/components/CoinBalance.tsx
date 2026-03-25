import { useCoinBalance } from "~/hooks/useCoinBalance";

interface CoinBalanceProps {
  userId: string;
}

export function CoinBalance({ userId }: CoinBalanceProps) {
  const { data: coins } = useCoinBalance(userId);
  if (coins === undefined) {
    return null;
  }
  return (
    <span className="text-text-muted text-xs">
      🪙 <span className="font-bold text-text">{coins.toLocaleString()}</span>
    </span>
  );
}
