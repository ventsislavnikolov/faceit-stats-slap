import { useState, useEffect } from "react";
import type { BettingPool, Bet, BetSide } from "~/lib/types";
import { isBettingOpen, calculatePayout, calculateReturnPct } from "~/lib/betting";
import { placeBet } from "~/server/betting";
import { useQueryClient } from "@tanstack/react-query";

interface BettingPanelProps {
  pool: BettingPool;
  userBet: Bet | null;
  userId: string | null;
  userCoins: number;
  matchId: string;
}

export function BettingPanel({ pool, userBet, userId, userCoins, matchId }: BettingPanelProps) {
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isOpen = isBettingOpen(pool.status, pool.closesAt);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const tick = () => {
      const ms = new Date(pool.closesAt).getTime() - Date.now();
      if (ms <= 0) { setTimeLeft("Closed"); return; }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pool.closesAt, isOpen]);

  async function handlePlaceBet() {
    if (!userId || !selectedSide) return;
    setLoading(true);
    setError(null);
    const result = await placeBet({
      data: { poolId: pool.id, side: selectedSide, amount, userId },
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
      <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">
        <div className="flex justify-between items-center">
          <span>
            Your bet:{" "}
            <span className="text-accent font-bold">
              {userBet.amount} coins on {userBet.side === "team1" ? pool.team1Name : pool.team2Name}
            </span>
          </span>
          <span>
            Potential:{" "}
            <span className={currentPayout > userBet.amount ? "text-accent" : "text-text-muted"}>
              {currentPayout} coins
            </span>
          </span>
        </div>
        {pool.status === "RESOLVED" && userBet.payout !== null && (
          <div className={`mt-1 font-bold ${userBet.payout > userBet.amount ? "text-accent" : "text-error"}`}>
            {userBet.payout > userBet.amount
              ? `Won ${userBet.payout} coins! (+${userBet.payout - userBet.amount})`
              : "Lost this bet."}
          </div>
        )}
        {pool.status === "REFUNDED" && (
          <div className="mt-1 text-text-muted">Match cancelled — bet refunded.</div>
        )}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-3 pt-3 border-t border-border text-xs text-text-dim text-center">
        <a href="/sign-in" className="text-accent hover:underline">Sign in</a> to bet
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Place Bet</span>
        {isOpen ? (
          <span className="text-[10px] text-text-muted">
            Closes in <span className="text-accent">{timeLeft}</span>
          </span>
        ) : (
          <span className="text-[10px] text-error">Betting closed</span>
        )}
      </div>

      {/* Team buttons */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {(["team1", "team2"] as BetSide[]).map((side) => {
          const name = side === "team1" ? pool.team1Name : pool.team2Name;
          const sidePool = side === "team1" ? pool.team1Pool : pool.team2Pool;
          const oppPool = side === "team1" ? pool.team2Pool : pool.team1Pool;
          const retPct = calculateReturnPct(amount, sidePool + (selectedSide === side ? amount : 0), oppPool);
          const isSelected = selectedSide === side;
          return (
            <button
              key={side}
              disabled={!isOpen}
              onClick={() => setSelectedSide(side)}
              className={`rounded p-2 text-xs text-left transition-colors border ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-elevated hover:border-accent/40"
              } disabled:opacity-40`}
            >
              <div className="font-bold truncate">{name}</div>
              <div className="text-text-muted mt-0.5">
                {sidePool} coins
                {retPct > 0 && <span className="text-accent ml-1">+{retPct}%</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Amount input */}
      {isOpen && (
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={10}
            max={Math.min(500, userCoins)}
            value={amount}
            onChange={(e) => setAmount(Math.max(10, Math.min(500, parseInt(e.target.value) || 10)))}
            className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
          <span className="text-[10px] text-text-dim">
            Balance: <span className="text-text">{userCoins}</span>
          </span>
          {selectedSide && potentialPayout > 0 && (
            <span className="text-[10px] text-text-dim ml-auto">
              → <span className="text-accent">{potentialPayout}</span>
            </span>
          )}
        </div>
      )}

      {error && <p className="text-error text-[10px] mt-1">{error}</p>}

      {isOpen && (
        <button
          onClick={handlePlaceBet}
          disabled={!selectedSide || loading || amount > userCoins}
          className="mt-2 w-full bg-accent text-bg text-xs font-bold py-1.5 rounded hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "..." : "Place Bet"}
        </button>
      )}
    </div>
  );
}
