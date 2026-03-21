import { useCoinBalance } from "~/hooks/useCoinBalance";

interface CoinBalanceProps {
  userId: string;
}

export function CoinBalance({ userId }: CoinBalanceProps) {
  const { data: coins } = useCoinBalance(userId);
  if (coins === undefined) return null;
  return (
    <span className="text-xs text-text-muted">
      🪙 <span className="text-text font-bold">{coins.toLocaleString()}</span>
    </span>
  );
}
