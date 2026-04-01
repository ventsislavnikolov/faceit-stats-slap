import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  calculatePayout,
  calculateReturnPct,
  isBettingOpen,
} from "~/lib/betting";
import type { Bet, BetSide, BettingPool } from "~/lib/types";
import { placeBet } from "~/server/betting";

interface BettingPanelProps {
  matchId: string;
  pool: BettingPool;
  seasonId: string;
  userBet: Bet | null;
  userCoins: number;
  userId: string | null;
}

export function BettingPanel({
  pool,
  seasonId,
  userBet,
  userId,
  userCoins,
  matchId,
}: BettingPanelProps) {
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isOpen = isBettingOpen(pool.status, pool.closesAt);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const tick = () => {
      const ms = new Date(pool.closesAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft("Closed");
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pool.closesAt, isOpen]);

  async function handlePlaceBet() {
    if (!(userId && selectedSide)) {
      return;
    }
    setLoading(true);
    setError(null);
    const result = await placeBet({
      data: { seasonId, poolId: pool.id, side: selectedSide, amount, userId },
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Failed to place bet");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["betting-pool", matchId] });
    queryClient.invalidateQueries({ queryKey: ["coin-balance", userId] });
  }

  const potentialPayout = selectedSide
    ? calculatePayout(
        amount,
        selectedSide === "team1" ? pool.team1Pool + amount : pool.team1Pool,
        selectedSide === "team2" ? pool.team2Pool + amount : pool.team2Pool
      )
    : 0;

  // Post-bet view
  if (userBet) {
    const betPool = userBet.side === "team1" ? pool.team1Pool : pool.team2Pool;
    const oppPool = userBet.side === "team1" ? pool.team2Pool : pool.team1Pool;
    const currentPayout = calculatePayout(userBet.amount, betPool, oppPool);
    return (
      <div className="mt-3 border-border border-t pt-3 text-text-muted text-xs">
        <div className="flex items-center justify-between">
          <span>
            Your bet:{" "}
            <span className="font-bold text-accent">
              {userBet.amount} coins on{" "}
              {userBet.side === "team1" ? pool.team1Name : pool.team2Name}
            </span>
          </span>
          <span>
            Potential:{" "}
            <span
              className={
                currentPayout > userBet.amount
                  ? "text-accent"
                  : "text-text-muted"
              }
            >
              {currentPayout} coins
            </span>
          </span>
        </div>
        {pool.status === "RESOLVED" && userBet.payout !== null && (
          <div
            className={`mt-1 font-bold ${userBet.payout > userBet.amount ? "text-accent" : "text-error"}`}
          >
            {userBet.payout > userBet.amount
              ? `Won ${userBet.payout} coins! (+${userBet.payout - userBet.amount})`
              : "Lost this bet."}
          </div>
        )}
        {pool.status === "REFUNDED" && (
          <div className="mt-1 text-text-muted">
            Match cancelled — bet refunded.
          </div>
        )}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-3 border-border border-t pt-3 text-center text-text-dim text-xs">
        <a className="text-accent hover:underline" href="/sign-in">
          Sign in
        </a>{" "}
        to bet
      </div>
    );
  }

  return (
    <div className="mt-3 border-border border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          Place Bet
        </span>
        {isOpen ? (
          <span className="text-[10px] text-text-muted">
            Closes in <span className="text-accent">{timeLeft}</span>
          </span>
        ) : (
          <span className="text-[10px] text-error">Betting closed</span>
        )}
      </div>

      {/* Team buttons */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {(["team1", "team2"] as BetSide[]).map((side) => {
          const name = side === "team1" ? pool.team1Name : pool.team2Name;
          const sidePool = side === "team1" ? pool.team1Pool : pool.team2Pool;
          const oppPool = side === "team1" ? pool.team2Pool : pool.team1Pool;
          const retPct = calculateReturnPct(
            amount,
            sidePool + (selectedSide === side ? amount : 0),
            oppPool
          );
          const isSelected = selectedSide === side;
          return (
            <button
              className={`rounded border p-2 text-left text-xs transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-elevated hover:border-accent/40"
              } disabled:opacity-40`}
              disabled={!isOpen}
              key={side}
              onClick={() => setSelectedSide(side)}
            >
              <div className="truncate font-bold">{name}</div>
              <div className="mt-0.5 text-text-muted">
                {sidePool} coins
                {retPct > 0 && (
                  <span className="ml-1 text-accent">+{retPct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bet info */}
      {isOpen && (
        <div className="flex items-center gap-2">
          <input
            className="w-24 rounded border border-border bg-bg-elevated px-2 py-1 text-text text-xs focus:border-accent focus:outline-none"
            max={userCoins}
            min={1}
            onChange={(e) => {
              const val = Math.min(
                Math.max(1, Number.parseInt(e.target.value) || 1),
                userCoins
              );
              setAmount(val);
            }}
            type="number"
            value={amount}
          />
          <span className="text-[10px] text-text-dim">
            / <span className="text-text">{userCoins}</span> coins
          </span>
          {selectedSide && potentialPayout > 0 && (
            <span className="ml-auto text-[10px] text-text-dim">
              → <span className="text-accent">{potentialPayout}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-[10px] text-error">{error}</p>}

      {isOpen && (
        <button
          className="mt-2 w-full rounded bg-accent py-1.5 font-bold text-bg text-xs hover:opacity-90 disabled:opacity-40"
          disabled={!selectedSide || loading || amount > userCoins}
          onClick={handlePlaceBet}
        >
          {loading ? "..." : "Place Bet"}
        </button>
      )}
    </div>
  );
}
