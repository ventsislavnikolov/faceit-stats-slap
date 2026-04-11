import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Skeleton } from "boneyard-js/react";
import { useEffect, useState } from "react";
import { FriendsSidebar } from "~/components/FriendsSidebar";
import { LiveMatchCard } from "~/components/LiveMatchCard";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { RecentMatches } from "~/components/RecentMatches";
import { TwitchEmbed } from "~/components/TwitchEmbed";
import { useActiveSeason } from "~/hooks/useActiveSeason";
import { useCoinBalance } from "~/hooks/useCoinBalance";
import { useLiveMatches } from "~/hooks/useLiveMatches";
import { usePlayerStats } from "~/hooks/usePlayerStats";
import { useTrackedPlayerTarget } from "~/hooks/useTrackedPlayerTarget";
import { useTwitchLive } from "~/hooks/useTwitchLive";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import { getPlayingFriendIds } from "~/lib/friends";
import { isTrackedPlayerAlias } from "~/lib/tracked-player-alias";
import { buildTrackedPlayerSearch } from "~/lib/tracked-route";
import { searchAndLoadFriends } from "~/server/friends";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

export const Route = createFileRoute("/_authed/$nickname")({
  validateSearch: (search: Record<string, unknown>) => ({
    resolvedPlayerId:
      typeof search.resolvedPlayerId === "string" &&
      search.resolvedPlayerId.length > 0
        ? search.resolvedPlayerId
        : undefined,
  }),
  component: PlayerDashboard,
});

export function PlayerDashboard() {
  const { nickname } = Route.useParams();
  const { resolvedPlayerId } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(nickname);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getClientSession().then((s) => setUserId(s?.user.id ?? null));
  }, []);

  const { data: userCoins = 0 } = useCoinBalance(userId);
  const { data: activeSeason } = useActiveSeason();
  const seasonId = activeSeason?.id ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    data: targetPlayer,
    isLoading: resolvingTarget,
    isError: searchError,
    isTrackedFlow,
  } = useTrackedPlayerTarget({
    page: "friends",
    player: nickname,
    resolvedPlayerId,
  });

  const targetPlayerId = targetPlayer?.faceitId ?? null;

  const {
    data: searchResult,
    isLoading: searchLoading,
    isError: searchResultError,
  } = useQuery({
    queryKey: ["friends-search", targetPlayerId],
    queryFn: () => searchAndLoadFriends({ data: targetPlayerId! }),
    enabled: !!targetPlayerId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const friendIds = [
    ...(searchResult?.player.faceitId ? [searchResult.player.faceitId] : []),
    ...(searchResult?.friends.map((f) => f.faceitId) ?? []),
  ];
  const { data: liveMatches = [] } = useLiveMatches(friendIds);
  const { data: twitchStreams = [] } = useTwitchLive();
  const { data: playerStats = [], isLoading: statsLoading } =
    usePlayerStats(selectedFriendId);

  const playingFriendIds = getPlayingFriendIds(liveMatches, twitchStreams);
  const enrichedFriends = (searchResult?.friends ?? []).map((f) => ({
    ...f,
    isPlaying: playingFriendIds.has(f.faceitId),
    currentMatchId:
      liveMatches.find((m) => m.friendIds.includes(f.faceitId))?.matchId ??
      null,
  }));

  const liveStream = twitchStreams.find((s) => s.isLive);
  const hasTrackedPlayerMiss =
    isTrackedFlow &&
    !resolvingTarget &&
    !searchError &&
    !searchResultError &&
    !targetPlayerId;

  useEffect(() => {
    if (
      !(isTrackedFlow && targetPlayer?.faceitId) ||
      resolvedPlayerId === targetPlayer.faceitId
    ) {
      return;
    }

    navigate({
      to: "/$nickname",
      params: { nickname },
      replace: true,
      search: buildTrackedPlayerSearch({
        currentPlayer: nickname,
        currentResolvedPlayerId: resolvedPlayerId,
        nextResolvedPlayerId: targetPlayer.faceitId,
      }),
    });
  }, [
    isTrackedFlow,
    navigate,
    nickname,
    resolvedPlayerId,
    targetPlayer?.faceitId,
  ]);

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
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) {
      return;
    }

    if (target.kind === "match") {
      setSelectedFriendId(null);
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    if (
      target.value.toLowerCase() === nickname.toLowerCase() &&
      !isTrackedPlayerAlias(target.value)
    ) {
      return;
    }
    setSelectedFriendId(null);
    navigate({
      to: "/$nickname",
      params: { nickname: target.value },
      search:
        target.value.toLowerCase() === "tracked"
          ? buildTrackedPlayerSearch({
              currentPlayer: nickname,
              currentResolvedPlayerId: resolvedPlayerId,
              nextPlayer: target.value,
            })
          : undefined,
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        error={
          searchError || searchResultError
            ? "Player not found. Check the nickname/UUID and try again."
            : null
        }
        isSearching={resolvingTarget || searchLoading}
        layout="full"
        onSubmit={handleSearch}
        onValueChange={setInput}
        placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
        status={
          searchResult ? (
            <span>
              Showing friends of{" "}
              <span className="text-accent">
                {searchResult.player.nickname}
              </span>
              {" · "}
              {searchResult.friends.length} loaded
              {searchResult.limited && (
                <span className="ml-1 text-error">
                  (capped at 100 — player has {searchResult.totalFriends}{" "}
                  friends, more would exceed FACEIT rate limits)
                </span>
              )}
            </span>
          ) : null
        }
        value={input}
      />

      {/* Main layout */}
      {searchError ? (
        <div className="flex flex-1 items-center justify-center text-error text-sm">
          Player &quot;{nickname}&quot; not found on FACEIT.
        </div>
      ) : hasTrackedPlayerMiss ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
          No tracked player has recent activity yet.
        </div>
      ) : !searchLoading && enrichedFriends.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
          This player has no friends on FACEIT.
        </div>
      ) : (
        <div className="relative flex flex-1 overflow-hidden">
          {/* Mobile sidebar overlay — only when loaded */}
          {!searchLoading && sidebarOpen && (
            <button
              aria-label="Close sidebar"
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSidebarOpen(false);
                }
              }}
              type="button"
            />
          )}
          {/* Mobile sidebar drawer — only when loaded */}
          {!searchLoading && (
            <aside
              className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              <FriendsSidebar
                friends={enrichedFriends}
                onSelectFriend={(id) => {
                  setSelectedFriendId(id);
                  setSidebarOpen(false);
                }}
                selectedFriendId={selectedFriendId}
                twitchStreams={twitchStreams}
              />
            </aside>
          )}
          {/* Desktop sidebar with boneyard skeleton */}
          <div className="hidden lg:block">
            <FriendsSidebar
              friends={enrichedFriends}
              loading={searchLoading}
              onSelectFriend={setSelectedFriendId}
              selectedFriendId={selectedFriendId}
              twitchStreams={twitchStreams}
            />
          </div>
          {/* Main content with boneyard skeleton */}
          <Skeleton loading={searchLoading} name="friends-main">
            <main className="flex-1 overflow-y-auto p-4">
              {/* Mobile toggle button */}
              <button
                className="mb-3 flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-3 py-1.5 text-text-muted text-xs lg:hidden"
                onClick={() => setSidebarOpen(true)}
                type="button"
              >
                <span className="text-sm">☰</span> Live Party (
                {enrichedFriends.length})
              </button>
              {liveStream && <TwitchEmbed stream={liveStream} />}
              {liveMatches.map((match) => (
                <LiveMatchCard
                  key={match.matchId}
                  match={match}
                  seasonId={seasonId}
                  userCoins={userCoins}
                  userId={userId}
                />
              ))}
              {selectedFriendId ? (
                <Skeleton loading={statsLoading} name="friends-stats">
                  <RecentMatches matches={recentMatches} />
                </Skeleton>
              ) : (
                <div className="py-12 text-center text-sm text-text-dim">
                  Select a friend to view their match history
                </div>
              )}
            </main>
          </Skeleton>
        </div>
      )}
    </div>
  );
}
