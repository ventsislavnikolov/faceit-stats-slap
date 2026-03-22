import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FriendsSidebar } from "~/components/FriendsSidebar";
import { LiveMatchCard } from "~/components/LiveMatchCard";
import { RecentMatches } from "~/components/RecentMatches";
import { TwitchEmbed } from "~/components/TwitchEmbed";
import { useCoinBalance } from "~/hooks/useCoinBalance";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useTwitchLive } from "~/hooks/useTwitchLive";
import type { FriendWithStats, LiveMatch } from "~/lib/types";

export const Route = createFileRoute("/_authed/match/$matchId")({
  component: MatchDetailPage,
});

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session;
  });

function MatchDetailPage() {
  const { matchId } = Route.useParams();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getClientSession().then((session) => setUserId(session?.user.id ?? null));
  }, []);

  const { data: userCoins = 0 } = useCoinBalance(userId);
  const { data: twitchStreams = [] } = useTwitchLive();

  const { data, isLoading, isError, error } = useQuery<{
    match: LiveMatch;
    players: FriendWithStats[];
  }>({
    queryKey: ["match-dashboard", matchId],
    queryFn: async () => {
      const response = await fetch(
        `/api/faceit/match-dashboard?matchId=${encodeURIComponent(matchId)}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Match dashboard request failed: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 20_000,
  });
  const effectiveSelectedFriendId = selectedFriendId ?? data?.players[0]?.faceitId ?? null;
  const { data: playerStats = [], isLoading: statsLoading } = usePlayerStats(effectiveSelectedFriendId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-accent animate-pulse text-sm">Loading match...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-error text-sm">
          {error instanceof Error ? error.message : "Match not found"}
        </span>
      </div>
    );
  }

  const liveStream = twitchStreams.find(
    (stream) =>
      stream.isLive &&
      data.players.some((player) => player.faceitId === stream.faceitId)
  );
  const recentMatches = useMemo(
    () =>
      playerStats.slice(0, 10).map((m: any) => ({
        nickname: m.nickname,
        matchId: m.matchId,
        map: m.map,
        score: m.score,
        kdRatio: m.kdRatio,
        adr: m.adr,
        hsPercent: m.hsPercent,
        result: m.result,
        eloDelta: null,
      })),
    [playerStats]
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <FriendsSidebar
        friends={data.players}
        twitchStreams={twitchStreams}
        selectedFriendId={effectiveSelectedFriendId}
        onSelectFriend={setSelectedFriendId}
      />
      <main className="flex-1 p-4 overflow-y-auto">
        {liveStream && <TwitchEmbed stream={liveStream} />}
        <LiveMatchCard match={data.match} userId={userId} userCoins={userCoins} />
        {effectiveSelectedFriendId ? (
          statsLoading ? (
            <div className="text-accent animate-pulse text-sm text-center py-12">
              Loading match history...
            </div>
          ) : (
            <RecentMatches matches={recentMatches} />
          )
        ) : (
          <div className="text-text-dim text-sm text-center py-12">
            Select a player to view their match history
          </div>
        )}
      </main>
    </div>
  );
}
