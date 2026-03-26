import { MAP_COLORS, mapDisplayName } from "~/lib/last-party";
import type { MapStats } from "~/lib/types";

interface MapDistributionProps {
  maps: MapStats[];
}

export function MapDistribution({ maps }: MapDistributionProps) {
  if (maps.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Maps
      </div>
      <div className="flex flex-wrap gap-2">
        {maps.map((m) => (
          <div
            className="flex items-center gap-2 rounded border border-border bg-bg-card px-3 py-2"
            key={m.map}
          >
            <div
              className={`h-3 w-3 rounded-sm ${MAP_COLORS[m.map] ?? "bg-text-dim"}`}
            />
            <span className="font-semibold text-text text-xs">
              {mapDisplayName(m.map)}
            </span>
            <span className="text-[10px] text-text-muted">
              {m.gamesPlayed}G
            </span>
            <span className="text-[10px] text-accent">{m.wins}W</span>
            <span className="text-[10px] text-error">{m.losses}L</span>
            <span className="text-[10px] text-text-dim">{m.winRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
