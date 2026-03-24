import { useCoinBalance } from "~/hooks/useCoinBalance";
import { useUserBets } from "~/hooks/useUserBets";
import { buildBetHistorySummary, getBetOutcomeLabel } from "~/lib/betting-stats";

interface BetHistoryTabProps {
  userId: string | null;
}

function formatNet(amount: number, payout: number | null, status: string): string {
  if (status === "REFUNDED") {
    return "0";
  }

  if (status !== "RESOLVED") {
    return "—";
  }

  const net = (payout ?? 0) - amount;
  return `${net > 0 ? "+" : ""}${net}`;
}

function formatPayout(amount: number, payout: number | null, status: string): string {
  if (status === "REFUNDED") {
    return String(amount);
  }

  if (status !== "RESOLVED") {
    return "—";
  }

  return String(payout ?? 0);
}

export function BetHistoryTab({ userId }: BetHistoryTabProps) {
  const { data: coins = 0 } = useCoinBalance(userId);
  const { data: bets = [], isLoading, isError } = useUserBets(userId);

  if (!userId) {
    return <div className="py-12 text-center text-sm text-text-dim">Sign in to see your bets.</div>;
  }

  if (isLoading) {
    return <div className="py-8 text-center text-accent animate-pulse">Loading...</div>;
  }

  if (isError) {
    return <div className="py-12 text-center text-sm text-error">Failed to load betting history.</div>;
  }

  if (!bets.length) {
    return <div className="py-12 text-center text-sm text-text-dim">No bets placed yet.</div>;
  }

  const summary = buildBetHistorySummary(bets, coins);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Net P/L</div>
          <div className={`mt-1 text-lg font-bold ${summary.netProfit >= 0 ? "text-accent" : "text-error"}`}>
            {summary.netProfit > 0 ? "+" : ""}
            {summary.netProfit}
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Total Wagered</div>
          <div className="mt-1 text-lg font-bold text-text">{summary.totalWagered}</div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Total Returned</div>
          <div className="mt-1 text-lg font-bold text-text">{summary.totalReturned}</div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Placed</div>
          <div className="mt-1 text-lg font-bold text-text">{summary.betsPlaced}</div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Win Rate</div>
          <div className="mt-1 text-lg font-bold text-text">{summary.winRate}%</div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Coins</div>
          <div className="mt-1 text-lg font-bold text-text">{summary.coins}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider text-text-dim">Latest Bets</div>
        <div
          className="grid gap-2 px-3 pb-1 text-[10px] uppercase tracking-wider text-text-dim"
          style={{ gridTemplateColumns: "1.6fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr" }}
        >
          <span>Match</span>
          <span className="text-right">Pick</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Payout</span>
          <span className="text-right">Net</span>
          <span className="text-right">Status</span>
        </div>

        {bets.map((bet) => {
          const statusLabel = getBetOutcomeLabel(bet);
          const sideName = bet.side === "team1" ? bet.pool.team1Name : bet.pool.team2Name;

          return (
            <div
              key={bet.id}
              className="grid gap-2 rounded bg-bg-elevated px-3 py-2 text-sm"
              style={{ gridTemplateColumns: "1.6fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr" }}
            >
              <span className="truncate text-text">
                {bet.pool.team1Name} vs {bet.pool.team2Name}
              </span>
              <span className="text-right text-xs text-text-muted">{sideName}</span>
              <span className="text-right text-xs text-text-muted">{bet.amount}</span>
              <span className="text-right text-xs text-text-muted">
                {formatPayout(bet.amount, bet.payout, bet.pool.status)}
              </span>
              <span className="text-right text-xs text-text-muted">
                {formatNet(bet.amount, bet.payout, bet.pool.status)}
              </span>
              <span
                className={`text-right text-xs font-semibold ${
                  statusLabel === "Won"
                    ? "text-accent"
                    : statusLabel === "Lost"
                      ? "text-error"
                      : "text-text-muted"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
