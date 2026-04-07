import { useUserBets } from "~/hooks/useUserBets";
import type { BetHistoryItem } from "~/lib/types";

interface SeasonMyBetsTabProps {
  seasonId: string;
  userId: string | null;
}

function formatBetStatus(
  poolStatus: string,
  side: string,
  winningTeam: string | null
): { label: string; className: string } {
  if (poolStatus === "REFUNDED" || poolStatus === "refunded") {
    return { label: "Refunded", className: "text-text-muted" };
  }
  if (poolStatus === "RESOLVED" || poolStatus === "resolved") {
    if (winningTeam && side === winningTeam) {
      return { label: "Won", className: "text-accent" };
    }
    return { label: "Lost", className: "text-error" };
  }
  return { label: "Pending", className: "text-text-muted" };
}

function formatNet(
  amount: number,
  payout: number | null,
  status: string
): string {
  if (status === "REFUNDED" || status === "refunded") {
    return "0";
  }
  if (status !== "RESOLVED" && status !== "resolved") {
    return "\u2014";
  }
  const net = (payout ?? 0) - amount;
  return `${net > 0 ? "+" : ""}${net}`;
}

function getBetRowDisplay(bet: BetHistoryItem) {
  if (bet.kind === "match") {
    return {
      title: `${bet.pool.team1Name} vs ${bet.pool.team2Name}`,
      poolStatus: bet.pool.status,
      sideName: bet.side === "team1" ? bet.pool.team1Name : bet.pool.team2Name,
      winningSide: bet.pool.winningTeam,
    };
  }

  return {
    title: bet.prop.description,
    poolStatus: bet.prop.status,
    sideName: bet.side === "yes" ? "Yes" : "No",
    winningSide:
      bet.prop.outcome == null ? null : bet.prop.outcome ? "yes" : "no",
  };
}

export function SeasonMyBetsTab({
  seasonId: _seasonId,
  userId,
}: SeasonMyBetsTabProps) {
  const { data: allBets = [], isLoading, isError } = useUserBets(userId);

  if (!userId) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        Sign in to see your bets.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
            key={i}
            style={{ gridTemplateColumns: "1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr" }}
          >
            <div className="h-3 w-28 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-error text-sm">
        Failed to load bet history.
      </div>
    );
  }

  // TODO: filter by season once server-side season bet query is available
  const bets = allBets;

  if (!bets.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No bets placed yet this season.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
        style={{ gridTemplateColumns: "1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr" }}
      >
        <span>Match</span>
        <span className="text-right">Pick</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Payout</span>
        <span className="text-right">Net</span>
        <span className="text-right">Status</span>
      </div>

      {bets.map((bet) => {
        const row = getBetRowDisplay(bet);
        const poolStatus = row.poolStatus;
        const { label: statusLabel, className: statusClass } = formatBetStatus(
          poolStatus,
          bet.side,
          row.winningSide
        );
        const payout =
          poolStatus === "REFUNDED" || poolStatus === "refunded"
            ? String(bet.amount)
            : poolStatus === "RESOLVED" || poolStatus === "resolved"
              ? String(bet.payout ?? 0)
              : "\u2014";

        return (
          <div
            className="grid gap-2 rounded bg-bg-elevated px-3 py-2 text-sm"
            key={bet.id}
            style={{
              gridTemplateColumns: "1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.8fr",
            }}
          >
            <span className="truncate text-text">
              {row.title}
            </span>
            <span className="text-right text-text-muted text-xs">
              {row.sideName}
            </span>
            <span className="text-right text-text-muted text-xs">
              {bet.amount}
            </span>
            <span className="text-right text-text-muted text-xs">{payout}</span>
            <span className="text-right text-text-muted text-xs">
              {formatNet(bet.amount, bet.payout, poolStatus)}
            </span>
            <span className={`text-right font-semibold text-xs ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
