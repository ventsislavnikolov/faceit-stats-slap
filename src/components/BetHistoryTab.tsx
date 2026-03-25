import { useCoinBalance } from "~/hooks/useCoinBalance";
import { useUserBets } from "~/hooks/useUserBets";
import { formatBetTiming } from "~/lib/betting";
import {
  buildBetHistorySummary,
  getBetOutcomeLabel,
} from "~/lib/betting-stats";

interface BetHistoryTabProps {
  userId: string | null;
}

function formatNet(
  amount: number,
  payout: number | null,
  status: string
): string {
  if (status === "REFUNDED") {
    return "0";
  }

  if (status !== "RESOLVED") {
    return "—";
  }

  const net = (payout ?? 0) - amount;
  return `${net > 0 ? "+" : ""}${net}`;
}

function formatPayout(
  amount: number,
  payout: number | null,
  status: string
): string {
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
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        Sign in to see your bets.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse py-8 text-center text-accent">
        Loading...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load betting history.
      </div>
    );
  }

  if (!bets.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No bets placed yet.
      </div>
    );
  }

  const summary = buildBetHistorySummary(bets, coins);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Net P/L
          </div>
          <div
            className={`mt-1 font-bold text-lg ${summary.netProfit >= 0 ? "text-accent" : "text-error"}`}
          >
            {summary.netProfit > 0 ? "+" : ""}
            {summary.netProfit}
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Total Wagered
          </div>
          <div className="mt-1 font-bold text-lg text-text">
            {summary.totalWagered}
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Total Returned
          </div>
          <div className="mt-1 font-bold text-lg text-text">
            {summary.totalReturned}
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Placed
          </div>
          <div className="mt-1 font-bold text-lg text-text">
            {summary.betsPlaced}
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Win Rate
          </div>
          <div className="mt-1 font-bold text-lg text-text">
            {summary.winRate}%
          </div>
        </div>
        <div className="rounded bg-bg-elevated px-4 py-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            Coins
          </div>
          <div className="mt-1 font-bold text-lg text-text">
            {summary.coins}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-text-dim uppercase tracking-wider">
          Latest Bets
        </div>
        <div
          className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
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
          const sideName =
            bet.side === "team1" ? bet.pool.team1Name : bet.pool.team2Name;
          const timingLabel = formatBetTiming(
            bet.audit?.secondsSinceMatchStart
          );

          return (
            <div
              className="grid gap-2 rounded bg-bg-elevated px-3 py-2 text-sm"
              key={bet.id}
              style={{
                gridTemplateColumns: "1.6fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr",
              }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-text">
                  {bet.pool.team1Name} vs {bet.pool.team2Name}
                </span>
                {timingLabel ? (
                  <span className="truncate text-[10px] text-text-dim">
                    {timingLabel}
                  </span>
                ) : null}
              </span>
              <span className="text-right text-text-muted text-xs">
                {sideName}
              </span>
              <span className="text-right text-text-muted text-xs">
                {bet.amount}
              </span>
              <span className="text-right text-text-muted text-xs">
                {formatPayout(bet.amount, bet.payout, bet.pool.status)}
              </span>
              <span className="text-right text-text-muted text-xs">
                {formatNet(bet.amount, bet.payout, bet.pool.status)}
              </span>
              <span
                className={`text-right font-semibold text-xs ${
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
