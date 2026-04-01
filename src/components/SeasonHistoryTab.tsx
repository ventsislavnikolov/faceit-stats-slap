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
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              className="h-8 w-28 animate-pulse rounded bg-bg-elevated"
              key={i}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
              key={i}
              style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
            >
              <div className="h-3 w-6 animate-pulse rounded bg-border" />
              <div className="h-3 w-24 animate-pulse rounded bg-border" />
              <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" />
              <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
              <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
            </div>
          ))}
        </div>
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
