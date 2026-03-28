import { formatSeasonDateRange } from "~/lib/seasons";
import type { Season } from "~/lib/types";

interface SeasonHeaderProps {
  season: Season;
  userCoins: number | null;
}

export function SeasonHeader({ season, userCoins }: SeasonHeaderProps) {
  const statusColors: Record<string, string> = {
    upcoming: "bg-yellow-500/20 text-yellow-400",
    active: "bg-accent/20 text-accent",
    completed: "bg-text-dim/20 text-text-dim",
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-lg text-text">{season.name}</h2>
        <span className="text-sm text-text-dim">
          {formatSeasonDateRange(season.startsAt, season.endsAt)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-bold text-xs uppercase ${statusColors[season.status] ?? ""}`}
        >
          {season.status}
        </span>
      </div>
      {userCoins !== null && (
        <div className="font-bold text-accent text-sm">
          {userCoins.toLocaleString()} coins
        </div>
      )}
    </div>
  );
}
