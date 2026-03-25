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
      <div className="flex flex-1 items-center justify-center">
        <span className="animate-pulse text-accent text-sm">
          Loading match...
        </span>
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
