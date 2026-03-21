import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useCoinBalance } from "~/hooks/useCoinBalance";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session;
  });
import { useLiveMatches } from "~/hooks/useLiveMatches";
import { useTwitchLive } from "~/hooks/useTwitchLive";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { FriendsSidebar } from "~/components/FriendsSidebar";
import { TwitchEmbed } from "~/components/TwitchEmbed";
import { LiveMatchCard } from "~/components/LiveMatchCard";
import { RecentMatches } from "~/components/RecentMatches";
import { searchAndLoadFriends } from "~/server/friends";

export const Route = createFileRoute("/_authed/$nickname")({
  component: PlayerDashboard,
});

function PlayerDashboard() {
  const { nickname } = Route.useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(nickname);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getClientSession().then((s) => setUserId(s?.user.id ?? null));
  }, []);

  const { data: userCoins = 0 } = useCoinBalance(userId);

  const {
    data: searchResult,
    isLoading: searchLoading,
    isError: searchError,
  } = useQuery({
    queryKey: ["friends-search", nickname.toLowerCase()],
    queryFn: () => searchAndLoadFriends({ data: nickname }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const friendIds = searchResult?.friends.map((f) => f.faceitId) ?? [];
  const { data: liveMatches = [] } = useLiveMatches(friendIds.length > 0 ? friendIds : undefined);
  const { data: twitchStreams = [] } = useTwitchLive();
  const { data: playerStats = [], isLoading: statsLoading } = usePlayerStats(selectedFriendId);

  const playingFriendIds = new Set(liveMatches.flatMap((m) => m.friendIds));
  const enrichedFriends = (searchResult?.friends ?? []).map((f) => ({
    ...f,
    isPlaying: playingFriendIds.has(f.faceitId),
    currentMatchId: liveMatches.find((m) => m.friendIds.includes(f.faceitId))?.matchId ?? null,
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === nickname.toLowerCase()) return;
    setSelectedFriendId(null);
    navigate({ to: "/$nickname", params: { nickname: trimmed } });
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border bg-bg-card">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="FACEIT nickname or player UUID..."
            className="flex-1 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text focus:border-accent outline-none"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="bg-accent text-bg text-sm font-bold px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
          >
            {searchLoading ? "..." : "Search"}
          </button>
        </form>

        {searchResult && (
          <div className="mt-1.5 text-xs text-text-muted">
            Showing friends of{" "}
            <span className="text-accent">{searchResult.player.nickname}</span>
            {" · "}
            {searchResult.friends.length} loaded
            {searchResult.limited && (
              <span className="text-error ml-1">
                (capped at 20 — player has {searchResult.totalFriends} friends,
                more would exceed FACEIT rate limits)
              </span>
            )}
          </div>
        )}

        {searchError && (
          <p className="mt-1.5 text-xs text-error">
            Player not found. Check the nickname/UUID and try again.
          </p>
        )}
      </div>

      {/* Main layout */}
      {searchLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-accent animate-pulse text-sm">
            Loading friends for <span className="font-bold">{nickname}</span> (up to 20)...
          </div>
        </div>
      ) : searchError ? (
        <div className="flex items-center justify-center flex-1 text-error text-sm">
          Player &quot;{nickname}&quot; not found on FACEIT.
        </div>
      ) : enrichedFriends.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-text-dim text-sm">
          This player has no friends on FACEIT.
        </div>
      ) : (
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
              <LiveMatchCard key={match.matchId} match={match} userId={userId} userCoins={userCoins} />
            ))}
            {selectedFriendId ? (
              statsLoading ? (
                <div className="text-accent animate-pulse text-sm text-center py-12">
                  Loading match history...
                </div>
              ) : (
                <RecentMatches matches={recentMatches} />
              )
            ) : (
              <div className="text-text-dim text-sm text-center py-12">
                Select a friend to view their match history
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
