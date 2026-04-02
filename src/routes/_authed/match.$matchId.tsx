import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AnalystDashboard } from "~/components/AnalystDashboard";
import { MatchAnalyticsScoreboard } from "~/components/MatchAnalyticsScoreboard";
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
    return (
      <div className="mx-auto max-w-6xl p-4">
        {/* Match header skeleton */}
        <div className="mb-4 rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-2.5 w-36 animate-pulse rounded bg-border" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-right">
              <div className="mb-1 ml-auto h-3.5 w-24 animate-pulse rounded bg-border" />
              <div className="ml-auto h-7 w-8 animate-pulse rounded bg-border" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-2.5 w-14 animate-pulse rounded bg-border" />
              <div className="h-3 w-12 animate-pulse rounded bg-border" />
            </div>
            <div className="text-left">
              <div className="mb-1 h-3.5 w-24 animate-pulse rounded bg-border" />
              <div className="h-7 w-8 animate-pulse rounded bg-border" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="mb-4 flex items-center justify-center rounded-lg border border-border bg-bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="flex-1 px-4 py-3 text-center" key={i}>
              <div className="mx-auto h-3 w-20 animate-pulse rounded bg-border" />
            </div>
          ))}
        </div>

        {/* Score Progression chart skeleton */}
        <div className="mb-4 rounded-lg border border-border p-4">
          <div className="mb-4 h-2.5 w-32 animate-pulse rounded bg-border" />
          <div className="flex h-48 items-end gap-1 px-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div className="flex flex-1 flex-col items-center gap-1" key={i}>
                <div
                  className="w-full animate-pulse rounded-t bg-border"
                  style={{
                    height: `${Math.min(20 + i * 6, 140)}px`,
                    opacity: 0.3 + (i / 24) * 0.4,
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

        {/* Scoreboard skeleton */}
        <div className="mb-4 rounded-lg border border-border p-4">
          <div className="mb-4 h-2.5 w-64 animate-pulse rounded bg-border" />
          {/* Column headers */}
          <div className="mb-2 grid grid-cols-[1fr_4rem_3rem_3rem_3rem_4rem_4rem_4rem_3rem] gap-2 px-2">
            {[
              "w-12",
              "w-6",
              "w-4",
              "w-4",
              "w-4",
              "w-6",
              "w-6",
              "w-6",
              "w-8",
            ].map((w, i) => (
              <div
                className={`h-2 ${w} animate-pulse rounded bg-border ${i > 0 ? "mx-auto" : ""}`}
                key={i}
              />
            ))}
          </div>
          {/* Team 1 rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="grid grid-cols-[1fr_4rem_3rem_3rem_3rem_4rem_4rem_4rem_3rem] items-center gap-2 border-border border-t px-2 py-2.5"
              key={`t1-${i}`}
            >
              <div className="h-3.5 w-20 animate-pulse rounded bg-accent/20" />
              <div className="mx-auto h-3.5 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-6 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-6 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-5 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3.5 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-7 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-6 w-6 animate-pulse rounded-full bg-accent/15" />
            </div>
          ))}
          {/* Team separator */}
          <div className="my-1 border-border border-t" />
          {/* Team 2 rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="grid grid-cols-[1fr_4rem_3rem_3rem_3rem_4rem_4rem_4rem_3rem] items-center gap-2 border-border border-t px-2 py-2.5"
              key={`t2-${i}`}
            >
              <div className="h-3.5 w-20 animate-pulse rounded bg-error/20" />
              <div className="mx-auto h-3.5 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-6 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-6 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-5 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3.5 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-7 animate-pulse rounded bg-border" />
              <div className="mx-auto h-3 w-8 animate-pulse rounded bg-border" />
              <div className="mx-auto h-6 w-6 animate-pulse rounded-full bg-error/15" />
            </div>
          ))}
        </div>

        {/* Utility Thrown chart skeleton */}
        <div className="rounded-lg border border-border p-4">
          <div className="mb-4 h-2.5 w-28 animate-pulse rounded bg-border" />
          <div className="flex h-36 items-end justify-around gap-3 px-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div className="flex flex-1 flex-col items-center gap-1" key={i}>
                <div
                  className="w-full animate-pulse rounded-t bg-border"
                  style={{ height: `${40 + Math.random() * 80}px` }}
                />
                <div className="h-2 w-10 animate-pulse rounded bg-border" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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
