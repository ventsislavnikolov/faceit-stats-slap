import type { SessionScoreBreakdown } from "~/lib/types";

interface PlayerSessionBreakdownProps {
  bestMapId?: string;
  breakdown: SessionScoreBreakdown;
  worstMapId?: string;
}

export function PlayerSessionBreakdown({
  bestMapId,
  breakdown,
  worstMapId,
}: PlayerSessionBreakdownProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-dim">
      <span>
        <span className="text-text">Strong:</span>{" "}
        {breakdown.strongestReasons.join(", ")}
      </span>
      {breakdown.weakestCategory ? (
        <span>
          <span className="text-text">Weak:</span> {breakdown.weakestCategory}
        </span>
      ) : null}
      {bestMapId ? (
        <span>
          <span className="text-text">Best map</span> {bestMapId}
        </span>
      ) : null}
      {worstMapId ? (
        <span>
          <span className="text-text">Worst map</span> {worstMapId}
        </span>
      ) : null}
    </div>
  );
}
