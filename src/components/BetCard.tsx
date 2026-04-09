import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  calculatePayout,
  calculateReturnPct,
  isBettingOpen,
} from "~/lib/betting";
import type { BetWithNickname, BettingPoolStatus } from "~/lib/types";
import { placeBet } from "~/server/betting";

interface BetCardSide {
  label: string;
  pool: number;
}

interface BetCardProps {
  allBets?: BetWithNickname[];
  closesAt: string;
  existingBet?: { side: string; amount: number; payout: number | null } | null;
  id: string;
  label: string;
  seasonId: string;
  side1: BetCardSide;
  side2: BetCardSide;
  status: string;
  sublabel?: string;
  type: "match" | "prop";
  userCoins: number;
  userId: string | null;
  winningTeam?: string | null;
}

export function BetCard({
  allBets = [],
  closesAt,
  existingBet,
  id,
  label,
  seasonId,
  side1,
  side2,
  status,
  sublabel,
  type,
  userCoins,
  userId,
  winningTeam,
}: BetCardProps) {
  const queryClient = useQueryClient();
  const side1Key = type === "match" ? "team1" : "yes";
  const side2Key = type === "match" ? "team2" : "no";

  const cardBets = allBets.filter((b) =>
    type === "match" ? b.poolId === id : b.propPoolId === id
  );

  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isOpen = isBettingOpen(status as BettingPoolStatus, closesAt);
  const canBet = isOpen && userId && userCoins > 0 && !existingBet;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft("Closed");
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [closesAt, isOpen]);

  const sidePool = (side: string) =>
    side === side1Key ? side1.pool : side2.pool;
  const oppPool = (side: string) =>
    side === side1Key ? side2.pool : side1.pool;

  const potentialPayout = selectedSide
    ? calculatePayout(
        amount,
        sidePool(selectedSide) + amount,
        oppPool(selectedSide)
      )
    : 0;

  async function handlePlaceBet() {
    if (!(userId && selectedSide && amount > 0)) {
      return;
    }
    setLoading(true);
    setError(null);
    const result = await placeBet({
      data: {
        seasonId,
        ...(type === "match" ? { poolId: id } : { propPoolId: id }),
        side: selectedSide,
        amount,
        userId,
      },
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Failed to place bet");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["betting-pool"] });
    queryClient.invalidateQueries({ queryKey: ["prop-pools"] });
    queryClient.invalidateQueries({ queryKey: ["all-bets-for-match"] });
    queryClient.invalidateQueries({ queryKey: ["season-coin-balance"] });
    queryClient.invalidateQueries({ queryKey: ["season-leaderboard"] });
  }

  function handleAllIn() {
    setAmount(userCoins);
  }

  if (existingBet) {
    const betSideLabel =
      existingBet.side === side1Key ? side1.label : side2.label;
    const isResolved = status === "RESOLVED" || status === "resolved";
    const isRefunded = status === "REFUNDED" || status === "refunded";
    const won =
      isResolved && winningTeam != null && existingBet.side === winningTeam;
    const lost = isResolved && !won;

    return (
      <div className="rounded-lg border border-border bg-bg-elevated p-4">
        <div className="mb-1 font-bold text-sm text-text">{label}</div>
        {sublabel && (
          <div className="mb-2 text-text-muted text-xs">{sublabel}</div>
        )}
        <div className="text-text-muted text-xs">
          Your bet:{" "}
          <span className="font-bold text-accent">
            {existingBet.amount} coins on {betSideLabel}
          </span>
        </div>
        {isResolved && existingBet.payout !== null && (
          <div
            className={`mt-1 font-bold text-xs ${won ? "text-accent" : "text-error"}`}
          >
            {won
              ? (existingBet.payout ?? 0) > existingBet.amount
                ? `Won ${existingBet.payout} coins! (+${(existingBet.payout ?? 0) - existingBet.amount})`
                : "Correct pick! Bet returned."
              : "Lost this bet."}
          </div>
        )}
        {isRefunded && (
          <div className="mt-1 text-text-muted text-xs">
            Bet refunded ({existingBet.amount} coins returned).
          </div>
        )}
        {cardBets.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <div className="mb-1 text-[10px] text-text-dim uppercase tracking-wider">
              All bets
            </div>
            {cardBets.map((bet) => (
              <div
                className={`flex justify-between text-xs ${bet.userId === userId ? "text-accent" : "text-text-muted"}`}
                key={bet.id}
              >
                <span>
                  {bet.nickname}{" "}
                  <span className="text-text-dim">
                    on {bet.side === side1Key ? side1.label : side2.label}
                  </span>
                </span>
                <span className="font-bold">{bet.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold text-sm text-text">{label}</span>
        {isOpen && (
          <span className="font-mono text-accent text-xs">{timeLeft}</span>
        )}
        {!isOpen && <span className="text-error text-xs">Closed</span>}
      </div>
      {sublabel && (
        <div className="mb-2 text-text-muted text-xs">{sublabel}</div>
      )}

      <div className="mb-2 grid grid-cols-2 gap-2">
        {[
          { key: side1Key, side: side1 },
          { key: side2Key, side: side2 },
        ].map(({ key, side }) => {
          const retPct = calculateReturnPct(
            amount,
            side.pool + (selectedSide === key ? amount : 0),
            oppPool(key)
          );
          const isSelected = selectedSide === key;
          return (
            <button
              className={`rounded border p-2 text-left text-xs transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-elevated hover:border-accent/40"
              } disabled:opacity-40`}
              disabled={!canBet}
              key={key}
              onClick={() => setSelectedSide(key)}
              type="button"
            >
              <div className="truncate font-bold">{side.label}</div>
              <div className="mt-0.5 text-text-muted">
                {side.pool} coins
                {retPct > 0 && (
                  <span className="ml-1 text-accent">+{retPct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {canBet && (
        <div className="mb-2 flex items-center gap-2">
          <input
            className="w-20 rounded border border-border bg-bg px-2 py-1 text-text text-xs"
            max={userCoins}
            min={1}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val)) {
                setAmount(Math.max(1, Math.min(val, userCoins)));
              }
            }}
            type="number"
            value={amount}
          />
          <button
            className="rounded bg-error/20 px-2 py-1 font-bold text-error text-xs"
            onClick={handleAllIn}
            type="button"
          >
            ALL IN
          </button>
          <span className="ml-auto text-text-dim text-xs">
            Balance: {userCoins}
          </span>
          {selectedSide && potentialPayout > 0 && (
            <span className="text-text-dim text-xs">
              &rarr; <span className="text-accent">{potentialPayout}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-error text-xs">{error}</p>}

      {canBet && (
        <button
          className="w-full rounded bg-accent py-1.5 font-bold text-bg-elevated text-xs hover:opacity-90 disabled:opacity-40"
          disabled={
            !selectedSide || loading || amount > userCoins || amount < 1
          }
          onClick={handlePlaceBet}
          type="button"
        >
          {loading ? "..." : "BET"}
        </button>
      )}

      {cardBets.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1 text-[10px] text-text-dim uppercase tracking-wider">
            All bets
          </div>
          {cardBets.map((bet) => (
            <div
              className={`flex justify-between text-xs ${bet.userId === userId ? "text-accent" : "text-text-muted"}`}
              key={bet.id}
            >
              <span>
                {bet.nickname}{" "}
                <span className="text-text-dim">
                  on {bet.side === side1Key ? side1.label : side2.label}
                </span>
              </span>
              <span className="font-bold">{bet.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
