import { createFileRoute, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState } from "react";
import { useFriends } from "~/hooks/useFriends";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { RecentMatches } from "~/components/RecentMatches";

const requireAuth = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" as any });
  });

export const Route = createFileRoute("/_authed/history")({
  beforeLoad: () => requireAuth(),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: friends = [] } = useFriends();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: stats = [], isLoading } = usePlayerStats(selectedId);

  const matches = stats.map((m: any) => ({
    nickname: m.nickname,
    matchId: m.matchId,
    map: m.map,
    score: m.score,
    kdRatio: m.kdRatio,
    adr: m.adr,
    hsPercent: m.hsPercent,
    result: m.result,
    eloDelta: null,
  }));

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Match History</h2>

      <div className="flex gap-2 flex-wrap mb-6">
        {friends.map((f) => (
          <button
            key={f.faceitId}
            onClick={() => setSelectedId(f.faceitId)}
            className={`text-xs px-3 py-1.5 rounded ${
              selectedId === f.faceitId
                ? "bg-accent text-bg font-bold"
                : "bg-bg-elevated text-text-muted hover:text-accent"
            }`}
          >
            {f.nickname}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : selectedId ? (
        <RecentMatches matches={matches} />
      ) : (
        <div className="text-text-dim text-center py-12">
          Select a friend to view history
        </div>
      )}
    </div>
  );
}
