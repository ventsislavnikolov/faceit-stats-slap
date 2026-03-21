import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFriends } from "~/hooks/useFriends";
import { useLiveMatches } from "~/hooks/useLiveMatches";
import { useTwitchLive } from "~/hooks/useTwitchLive";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { FriendsSidebar } from "~/components/FriendsSidebar";
import { TwitchEmbed } from "~/components/TwitchEmbed";
import { LiveMatchCard } from "~/components/LiveMatchCard";
import { RecentMatches } from "~/components/RecentMatches";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const { data: friends = [], isLoading: friendsLoading, isError: friendsError } = useFriends();
  const { data: liveMatches = [] } = useLiveMatches();
  const { data: twitchStreams = [] } = useTwitchLive();
  const { data: playerStats = [] } = usePlayerStats(selectedFriendId);

  const playingFriendIds = new Set(liveMatches.flatMap((m) => m.friendIds));
  const enrichedFriends = friends.map((f) => ({
    ...f,
    isPlaying: playingFriendIds.has(f.faceitId),
    currentMatchId:
      liveMatches.find((m) => m.friendIds.includes(f.faceitId))?.matchId ?? null,
  }));

  const liveStream = twitchStreams.find((s) => s.isLive);

  const recentMatches = playerStats.slice(0, 10).map((m: any) => ({
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

  if (friendsLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-accent animate-pulse">Loading friends...</div>
      </div>
    );
  }

  if (friendsError) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-error">Failed to load friends. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <FriendsSidebar
        friends={enrichedFriends}
        twitchStreams={twitchStreams}
        selectedFriendId={selectedFriendId}
        onSelectFriend={setSelectedFriendId}
      />

      <main className="flex-1 p-4 overflow-y-auto">
        {liveStream && <TwitchEmbed stream={liveStream} />}

        {liveMatches.map((match) => (
          <LiveMatchCard key={match.matchId} match={match} />
        ))}

        {selectedFriendId ? (
          <RecentMatches matches={recentMatches} />
        ) : (
          <div className="text-text-dim text-sm text-center py-12">
            Select a friend to view their match history
          </div>
        )}
      </main>
    </div>
  );
}
