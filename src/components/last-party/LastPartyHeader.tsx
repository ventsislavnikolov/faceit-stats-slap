import { computeSessionStreak } from "~/lib/last-party";
import type { PlayerHistoryMatch } from "~/lib/types";

interface LastPartyHeaderProps {
  date: string;
  lossCount: number;
  matches: PlayerHistoryMatch[];
  totalHoursPlayed: number;
  winCount: number;
}

export function LastPartyHeader({
  date,
  matches,
  winCount,
  lossCount,
  totalHoursPlayed,
}: LastPartyHeaderProps) {
  const streak = computeSessionStreak(matches);
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="rounded border border-border bg-bg-card p-4">
      <div className="mb-1 text-[10px] text-text-dim uppercase tracking-wider">
        Party Session
      </div>
      <div className="font-bold text-lg text-text">{formattedDate}</div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-text-dim">Matches </span>
          <span className="font-bold text-text">{matches.length}</span>
        </div>
        <div>
          <span className="font-bold text-accent">{winCount}W</span>
          <span className="text-text-dim"> - </span>
          <span className="font-bold text-error">{lossCount}L</span>
        </div>
        <div>
          <span className="text-text-dim">Hours </span>
          <span className="font-bold text-text">{totalHoursPlayed}h</span>
        </div>
        {streak.count >= 2 && (
          <div>
            <span className="text-text-dim">Best streak </span>
            <span
              className={`font-bold ${streak.type === "win" ? "text-accent" : "text-error"}`}
            >
              {streak.count}
              {streak.type === "win" ? "W" : "L"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
