import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SeasonLeaderboardTab } from "~/components/SeasonLeaderboardTab";
import type { Season } from "~/lib/types";
import { getSeasonHistory } from "~/server/seasons";

interface SeasonHistoryTabProps {
  userId?: string | null;
}

export function SeasonHistoryTab({ userId }: SeasonHistoryTabProps) {
  const {
    data: seasons = [],
    isLoading,
    isError,
  } = useQuery<Season[]>({
    queryKey: ["season-history"],
    queryFn: () => getSeasonHistory(),
    staleTime: 60_000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedSeason =
    seasons.find((s) => s.id === selectedId) ?? seasons[0] ?? null;

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
        Failed to load season history.
      </div>
    );
  }

  if (!seasons.length) {
    return (
      <div className="py-12 text-center text-sm text-text-dim">
        No completed seasons yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {seasons.map((season) => {
          const isActive = selectedSeason?.id === season.id;
          return (
            <button
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                isActive
                  ? "border-accent bg-accent/10 font-bold text-accent"
                  : "border-border text-text-muted hover:border-accent/40"
              }`}
              key={season.id}
              onClick={() => setSelectedId(season.id)}
              type="button"
            >
              {season.name}
            </button>
          );
        })}
      </div>

      {selectedSeason && (
        <SeasonLeaderboardTab season={selectedSeason} userId={userId} />
      )}
    </div>
  );
}
