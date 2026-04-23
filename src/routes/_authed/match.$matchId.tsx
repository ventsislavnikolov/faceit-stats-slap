import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AnalystDashboard } from "~/components/AnalystDashboard";
import { MatchAnalyticsScoreboard } from "~/components/MatchAnalyticsScoreboard";
import { TrackedMatchBanter } from "~/components/TrackedMatchBanter";
import { useMatchDetail } from "~/hooks/useMatchDetail";
import type { DemoMatchAnalytics } from "~/lib/types";

export const Route = createFileRoute("/_authed/match/$matchId")({
  component: MatchDetailPage,
});

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

function MatchDetailPage() {
  const { matchId } = Route.useParams();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getClientSession().then((session) => setUserId(session?.user.id ?? null));
  }, []);

  const { data, isLoading, isError, error } = useMatchDetail(matchId);

  if (isLoading) {
    return <MatchDetailSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-error text-sm">
          {error instanceof Error ? error.message : "Match not found"}
        </span>
      </div>
    );
  }

  const demoAnalytics =
    (data.demoAnalytics as DemoMatchAnalytics | null) ?? null;
  const hasParsedDemo = demoAnalytics?.ingestionStatus === "parsed";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4">
        {/* Match header */}
        <MatchHeader
          competitionName={data.competitionName}
          map={data.map}
          region={data.region}
          score={data.score}
          status={data.status}
          teams={data.teams}
        />

        {/* Content — key forces clean remount when switching between dashboard and fallback */}
        {hasParsedDemo && demoAnalytics ? (
          <AnalystDashboard
            demoAnalytics={demoAnalytics}
            key="analyst"
            matchData={data as any}
          />
        ) : (
          <MatchAnalyticsScoreboard
            demoPlayers={[]}
            faceitPlayers={data.players}
            key="fallback"
            onSelectPlayer={() => {}}
            selectedPlayerId={null}
            teams={data.teams}
          />
        )}

        <TrackedMatchBanter
          friendIds={data.friendIds ?? []}
          matchId={data.matchId}
          players={data.players}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match header
// ---------------------------------------------------------------------------

function MatchHeader({
  map,
  score,
  status,
  teams,
  competitionName,
  region,
}: {
  map: string;
  score: string;
  status: string;
  teams: {
    faction1: { name: string; score: number };
    faction2: { name: string; score: number };
  };
  competitionName: string;
  region: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-dim text-xs uppercase tracking-wider">
          {competitionName} · {region}
        </span>
        <span className="text-[10px] text-text-dim">{status}</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="text-right">
          <div className="font-medium text-sm text-text">
            {teams.faction1.name}
          </div>
          <div className="font-bold text-2xl text-text">
            {teams.faction1.score}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-dim uppercase">{map}</div>
          <div className="text-text-dim text-xs">{score}</div>
        </div>
        <div className="text-left">
          <div className="font-medium text-sm text-text">
            {teams.faction2.name}
          </div>
          <div className="font-bold text-2xl text-text">
            {teams.faction2.score}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the real scoreboard structure so it stays stable
// on narrow viewports (no overflow, no squished columns).
// ---------------------------------------------------------------------------

const SCOREBOARD_SKELETON_COLS = "minmax(0,1fr) 40px 40px 40px 48px 40px 44px";

function MatchDetailSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4">
        {/* Match header skeleton */}
        <div className="mb-4 rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="h-2.5 w-36 max-w-[60%] animate-pulse rounded bg-border" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
          </div>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="min-w-0 text-right">
              <div className="mb-1 ml-auto h-3.5 w-20 animate-pulse rounded bg-border sm:w-24" />
              <div className="ml-auto h-7 w-8 animate-pulse rounded bg-border" />
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="h-2.5 w-14 animate-pulse rounded bg-border" />
              <div className="h-3 w-12 animate-pulse rounded bg-border" />
            </div>
            <div className="min-w-0 text-left">
              <div className="mb-1 h-3.5 w-20 animate-pulse rounded bg-border sm:w-24" />
              <div className="h-7 w-8 animate-pulse rounded bg-border" />
            </div>
          </div>
        </div>

        {/* Score Progression chart skeleton */}
        <div className="mb-4 rounded-lg border border-border p-4">
          <div className="mb-4 h-2.5 w-32 animate-pulse rounded bg-border" />
          <div className="flex h-40 items-end gap-1 sm:h-48">
            {Array.from({ length: 24 }).map((_, i) => (
              <div className="flex flex-1 flex-col items-center gap-1" key={i}>
                <div
                  className="w-full animate-pulse rounded-t bg-border"
                  style={{
                    height: `${Math.min(20 + i * 5, 140)}px`,
                    opacity: 0.55 + (i / 24) * 0.35,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent/40" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-border" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-error/40" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-border" />
            </div>
          </div>
        </div>

        {/* Scoreboard skeleton — two separate team tables, matching the real
            MatchAnalyticsScoreboard layout (7 cols, ~252px fixed). */}
        <div className="mb-4 space-y-3">
          <TeamTableSkeleton accent="accent" />
          <TeamTableSkeleton accent="error" />
        </div>
      </div>
    </div>
  );
}

function TeamTableSkeleton({ accent }: { accent: "accent" | "error" }) {
  const nameBg = accent === "accent" ? "bg-accent/20" : "bg-error/20";

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Team name bar */}
      <div className="bg-surface-elevated px-3 py-2">
        <div className="h-3 w-24 animate-pulse rounded bg-border" />
      </div>

      {/* Column headers */}
      <div
        className="grid gap-1 border-border border-b px-3 py-1.5"
        style={{ gridTemplateColumns: SCOREBOARD_SKELETON_COLS }}
      >
        <div className="h-2 w-12 animate-pulse rounded bg-border" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            className="mx-auto h-2 w-4 animate-pulse rounded bg-border"
            key={i}
          />
        ))}
      </div>

      {/* Player rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          className="grid items-center gap-1 border-border border-t px-3 py-2"
          key={i}
          style={{ gridTemplateColumns: SCOREBOARD_SKELETON_COLS }}
        >
          <div className={`h-3.5 min-w-0 animate-pulse rounded ${nameBg}`} />
          {Array.from({ length: 6 }).map((__, j) => (
            <div
              className="mx-auto h-3 w-5 animate-pulse rounded bg-border"
              key={j}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
