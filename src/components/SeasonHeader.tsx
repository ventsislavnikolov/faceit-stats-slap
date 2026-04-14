import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatSeasonDateRange } from "~/lib/seasons";
import type { Season } from "~/lib/types";
import { cancelSeason, deleteSeason } from "~/server/seasons";

interface SeasonHeaderProps {
  adminUserId?: string | null;
  isAdmin?: boolean;
  season: Season;
  userCoins: number | null;
}

export function SeasonHeader({
  season,
  userCoins,
  isAdmin = false,
  adminUserId = null,
}: SeasonHeaderProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<null | "cancel" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    upcoming: "bg-yellow-500/20 text-yellow-400",
    active: "bg-accent/20 text-accent",
    completed: "bg-text-dim/20 text-text-dim",
  };

  async function handleCancel() {
    if (!adminUserId) {
      return;
    }
    if (
      !window.confirm(
        `Cancel "${season.name}"? This marks it completed and stops further betting.`
      )
    ) {
      return;
    }
    setBusy("cancel");
    setError(null);
    const result = await cancelSeason({
      data: { seasonId: season.id, userId: adminUserId },
    });
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel season.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["active-season"] });
    queryClient.invalidateQueries({ queryKey: ["season-history"] });
  }

  async function handleDelete() {
    if (!adminUserId) {
      return;
    }
    if (
      !window.confirm(
        `Delete "${season.name}" permanently? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy("delete");
    setError(null);
    const result = await deleteSeason({
      data: { seasonId: season.id, userId: adminUserId },
    });
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "Failed to delete season.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["active-season"] });
    queryClient.invalidateQueries({ queryKey: ["season-history"] });
  }

  const canCancel = isAdmin && season.status !== "completed";
  const canDelete = isAdmin && season.status === "upcoming";

  return (
    <div className="flex flex-col gap-2">
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
        <div className="flex items-center gap-3">
          {(canCancel || canDelete) && (
            <div className="flex items-center gap-2">
              {canCancel && (
                <button
                  className="rounded border border-border px-2 py-1 text-text-dim text-xs hover:border-error hover:text-error disabled:opacity-40"
                  disabled={busy !== null}
                  onClick={handleCancel}
                  type="button"
                >
                  {busy === "cancel" ? "Canceling..." : "Cancel Season"}
                </button>
              )}
              {canDelete && (
                <button
                  className="rounded border border-error/50 px-2 py-1 text-error text-xs hover:bg-error/10 disabled:opacity-40"
                  disabled={busy !== null}
                  onClick={handleDelete}
                  type="button"
                >
                  {busy === "delete" ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          )}
          {userCoins !== null && (
            <div className="font-bold text-accent text-sm">
              {userCoins.toLocaleString()} coins
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  );
}
