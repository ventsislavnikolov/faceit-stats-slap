import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useStatsLeaderboard } from "~/hooks/useStatsLeaderboard";
import { useSyncPlayerHistory } from "~/hooks/useSyncPlayerHistory";
import { BetsLeaderboardTab } from "~/components/BetsLeaderboardTab";
import {
  PageSectionTabs,
  shouldRenderPageSectionTabs,
} from "~/components/PageSectionTabs";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { MY_FACEIT_ID } from "~/lib/constants";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import {
  getLeaderboardTabs,
  normalizeLeaderboardTab,
  type LeaderboardTab,
} from "~/lib/leaderboard-page";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  type HistoryMatchCount,
} from "~/lib/history-page";
import {
  buildStatsLeaderboardSyncKey,
  buildStatsLeaderboardSyncPlayerIds,
  shouldAutoSyncStatsLeaderboard,
} from "~/lib/stats-leaderboard-sync";
import { searchAndLoadFriends } from "~/server/friends";
import { useEffect, useRef, useState } from "react";
import type { StatsLeaderboardEntry } from "~/lib/types";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

export const Route = createFileRoute("/_authed/leaderboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    player: (search.player as string) || undefined,
    tab: search.tab === "bets" ? "bets" : "stats",
  }),
  component: LeaderboardPage,
});

export function shouldRenderLeaderboardBetsTab(params: {
  authResolved: boolean;
  isSignedIn: boolean;
  selectedTab: LeaderboardTab;
}): boolean {
  return params.authResolved && params.isSignedIn && params.selectedTab === "bets";
}

type SortKey =
  | "avgImpact"
  | "avgKills"
  | "avgKd"
  | "avgAdr"
  | "winRate"
  | "avgHsPercent"
  | "avgKrRatio"
  | "gamesPlayed"
  | "avgFirstKills"
  | "avgClutchKills"
  | "avgUtilityDamage"
  | "avgEnemiesFlashed"
  | "avgEntryRate"
  | "avgSniperKills";
type SortDir = "asc" | "desc";
type StatGroup = "combat" | "entry" | "utility";

const STAT_GROUPS: { key: StatGroup; label: string }[] = [
  { key: "combat", label: "Combat" },
  { key: "entry", label: "Entry & Clutch" },
  { key: "utility", label: "Utility & Flash" },
];

const STATS_COLS: Record<
  StatGroup,
  { key: SortKey; label: string; decimals: number; suffix?: string }[]
> = {
  combat: [
    { key: "avgImpact", label: "Impact", decimals: 1 },
    { key: "avgKills", label: "Kills", decimals: 2 },
    { key: "avgKd", label: "K/D", decimals: 2 },
    { key: "avgAdr", label: "ADR", decimals: 1 },
    { key: "winRate", label: "WIN%", decimals: 0, suffix: "%" },
    { key: "avgHsPercent", label: "HS%", decimals: 0, suffix: "%" },
    { key: "avgKrRatio", label: "K/R", decimals: 2 },
  ],
  entry: [
    { key: "avgFirstKills", label: "FK", decimals: 2 },
    { key: "avgEntryRate", label: "ER", decimals: 2 },
    { key: "avgClutchKills", label: "CK", decimals: 2 },
    { key: "avgSniperKills", label: "AWP", decimals: 2 },
  ],
  utility: [
    { key: "avgUtilityDamage", label: "UD", decimals: 0 },
    { key: "avgEnemiesFlashed", label: "EF", decimals: 1 },
  ],
};

function fmt(val: number, decimals: number, suffix = "") {
  return val === 0 ? "—" : `${val.toFixed(decimals)}${suffix}`;
}

function sortEntries(
  entries: StatsLeaderboardEntry[],
  key: SortKey,
  dir: SortDir,
): StatsLeaderboardEntry[] {
  return [...entries].sort((a, b) =>
    dir === "desc" ? b[key] - a[key] : a[key] - b[key],
  );
}

function StatsTab({
  targetPlayerId,
  targetNickname,
  playerIds,
}: {
  targetPlayerId: string;
  targetNickname: string;
  playerIds: string[];
}) {
  const [n, setN] = useState<HistoryMatchCount>("yesterday");
  const [days, setDays] = useState<30 | 90 | 180 | 365 | 730>(30);
  const [queue, setQueue] = useState<"all" | "solo" | "party">("all");
  const [sortKey, setSortKey] = useState<SortKey>("avgImpact");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statGroup, setStatGroup] = useState<StatGroup>("combat");
  const attemptedSyncKeysRef = useRef<Set<string>>(new Set());

  const { data: leaderboard, isLoading } = useStatsLeaderboard({
    targetPlayerId,
    playerIds,
    n,
    days,
    queue,
  });
  const autoSync = useSyncPlayerHistory({
    targetPlayerId,
    playerIds: buildStatsLeaderboardSyncPlayerIds({ mode: "auto", playerIds }),
  });
  const manualSync = useSyncPlayerHistory({
    targetPlayerId,
    playerIds: buildStatsLeaderboardSyncPlayerIds({
      mode: "manual",
      playerIds,
    }),
  });

  const activeCols = STATS_COLS[statGroup];
  const entries = sortEntries(leaderboard?.entries ?? [], sortKey, sortDir);
  const leaderboardGridTemplate = `3rem 1fr 4rem repeat(${activeCols.length}, 5rem)`;
  const leaderboardMinWidth = `${48 + 320 + 64 + activeCols.length * 80 + (activeCols.length + 2) * 8 + 24}px`;
  const summaryCopy = leaderboard
    ? getStatsLeaderboardSummaryCopy(
        targetNickname,
        leaderboard.sharedFriendCount,
        days,
        n,
        queue,
      )
    : null;
  const emptyStateCopy = leaderboard
    ? getStatsLeaderboardEmptyStateCopy({
        targetNickname,
        targetMatchCount: leaderboard.targetMatchCount,
        sharedFriendCount: leaderboard.sharedFriendCount,
        days,
        n,
        queue,
      })
    : null;

  useEffect(() => {
    if (
      !shouldAutoSyncStatsLeaderboard({
        targetPlayerId,
        playerIds,
        n,
        days,
        isPending: autoSync.isPending,
        attemptedKeys: attemptedSyncKeysRef.current,
      })
    ) {
      return;
    }

    const key = buildStatsLeaderboardSyncKey({
      targetPlayerId,
      playerIds,
      n,
      days,
    });
    attemptedSyncKeysRef.current.add(key);
    autoSync.mutate({ n, days });
  }, [autoSync, days, n, playerIds, targetPlayerId]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rankColor = (i: number) =>
    i === 0
      ? "text-yellow-400"
      : i === 1
        ? "text-gray-400"
        : i === 2
          ? "text-amber-600"
          : "text-text-dim";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-dim">Last</span>
          <div className="flex gap-1">
            {getHistoryMatchCountOptions().map((option) => (
              <button
                key={option.value}
                onClick={() => setN(option.value)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  n === option.value
                    ? "bg-accent font-bold text-bg"
                    : "bg-bg-elevated text-text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-text-dim">games</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-dim">Queue</span>
          <div className="flex gap-1">
            {getHistoryQueueOptions().map((option) => (
              <button
                key={option.value}
                onClick={() => setQueue(option.value)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  queue === option.value
                    ? "bg-accent font-bold text-bg"
                    : "bg-bg-elevated text-text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-dim">In the last</span>
          <div className="flex gap-1">
            {([30, 90, 180, 365, 730] as const).map((v) => (
              <button
                key={v}
                onClick={() => setDays(v)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  days === v
                    ? "bg-accent font-bold text-bg"
                    : "bg-bg-elevated text-text-muted hover:text-text"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <span className="text-text-dim">days</span>
        </div>
        <button
          onClick={() => manualSync.mutate({ n, days })}
          disabled={manualSync.isPending || !targetPlayerId}
          className="rounded bg-bg-elevated px-3 py-1.5 text-xs transition-colors text-text-muted hover:text-text disabled:opacity-50"
        >
          {manualSync.isPending ? "Syncing..." : "↻ Refresh"}
        </button>
      </div>

      <div className="text-[10px] text-text-dim">
        Party means the player plus at least 2 known FACEIT friends in the same
        match.
      </div>

      {summaryCopy && (
        <div className="text-[10px] text-text-dim">{summaryCopy}</div>
      )}

      {autoSync.isPending && !manualSync.isPending && (
        <div className="text-[10px] text-text-dim">
          Syncing older history in the background...
        </div>
      )}

      <PageSectionTabs
        tabs={STAT_GROUPS.map((group) => ({
          key: group.key,
          label: group.label,
        }))}
        activeKey={statGroup}
        onChange={(key) => {
          const group = key as StatGroup;
          setStatGroup(group);
          setSortKey(STATS_COLS[group][0].key);
          setSortDir("desc");
        }}
      />

      {!targetPlayerId ? (
        <div className="text-text-dim text-center py-12">
          Search a player above to see who they queued with recently and how
          each friend is performing across their own recent matches
        </div>
      ) : isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">
          Loading...
        </div>
      ) : (
        <div className="flex w-full flex-col gap-1">
          {emptyStateCopy && (
            <div className="text-text-dim text-center py-12 text-sm">
              {emptyStateCopy}
            </div>
          )}

          {!emptyStateCopy && (
            <div className="w-full overflow-x-auto">
              <div
                className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
                style={{
                  gridTemplateColumns: leaderboardGridTemplate,
                  minWidth: leaderboardMinWidth,
                }}
              >
                <span>#</span>
                <span>Player</span>
                <span className="text-right">GP</span>
                {activeCols.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`text-right hover:text-text transition-colors ${
                      sortKey === col.key ? "text-accent" : ""
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === "desc"
                        ? " ↓"
                        : " ↑"
                      : ""}
                  </button>
                ))}
              </div>

              <div
                className="flex flex-col gap-1"
                style={{ minWidth: leaderboardMinWidth }}
              >
                {entries.map((entry, i) => {
                  const isMe = entry.faceitId === MY_FACEIT_ID;
                  return (
                    <div
                      key={entry.faceitId}
                      className={`grid gap-2 items-center rounded px-3 py-2 text-sm ${
                        isMe
                          ? "border-l-2 border-accent bg-accent/10"
                          : "bg-bg-elevated"
                      }`}
                      style={{ gridTemplateColumns: leaderboardGridTemplate }}
                    >
                      <span className={`text-xs font-bold ${rankColor(i)}`}>
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <span
                          className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}
                        >
                          {isMe ? "You" : entry.nickname}
                        </span>
                        {entry.elo > 0 && (
                          <span className="shrink-0 text-[10px] text-text-dim">
                            {entry.elo}
                          </span>
                        )}
                      </div>
                      <span className="text-right text-xs text-text-muted">
                        {entry.gamesPlayed || "—"}
                      </span>
                      {activeCols.map((col) => (
                        <span
                          key={col.key}
                          className={`text-right text-xs ${
                            sortKey === col.key
                              ? "font-semibold text-accent"
                              : "text-text-muted"
                          }`}
                        >
                          {fmt(entry[col.key], col.decimals, col.suffix)}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderboardPage() {
  const navigate = useNavigate();
  const { player: urlPlayer, tab: selectedTab } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");
  const [authResolved, setAuthResolved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const normalizedSelectedTab = authResolved
    ? normalizeLeaderboardTab(selectedTab, isSignedIn)
    : selectedTab;

  const {
    data: searchResult,
    isLoading: searchLoading,
    isError: searchError,
  } = useQuery({
    queryKey: ["friends-search", urlPlayer?.toLowerCase(), selectedTab],
    queryFn: () => searchAndLoadFriends({ data: urlPlayer! }),
    enabled: !!urlPlayer && normalizedSelectedTab === "stats",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  useEffect(() => {
    getClientSession().then((session) => {
      const signedIn = !!session;
      setUserId(session?.user.id ?? null);
      setIsSignedIn(signedIn);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (authResolved && !isSignedIn && selectedTab === "bets") {
      navigate({
        to: "/leaderboard",
        search: {
          player: urlPlayer,
          tab: "stats",
        },
        replace: true,
      });
    }
  }, [authResolved, isSignedIn, navigate, selectedTab, urlPlayer]);

  const friendIds = searchResult?.friends.map((f) => f.faceitId) ?? [];
  const targetPlayerId = searchResult?.player.faceitId ?? "";
  const targetNickname = searchResult?.player.nickname ?? "";
  const showBetsTab = normalizedSelectedTab === "bets";
  const tabs = authResolved
    ? getLeaderboardTabs(isSignedIn)
    : showBetsTab
      ? ["bets"]
      : ["stats"];
  const sectionTabs = tabs.map((tab) => ({
    key: tab,
    label: tab === "stats" ? "Stats" : "Bets",
  }));
  const shouldRenderBetsTab = shouldRenderLeaderboardBetsTab({
    authResolved,
    isSignedIn,
    selectedTab: normalizedSelectedTab,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) return;

    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    navigate({
      to: "/leaderboard",
      search: {
        player: target.value,
        tab: normalizedSelectedTab,
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        value={input}
        onValueChange={setInput}
        onSubmit={handleSearch}
        placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
        isSearching={searchLoading}
        status={
          searchResult ? (
            <span>
              Showing leaderboard for{" "}
              <span className="text-accent">
                {searchResult.player.nickname}
              </span>
            </span>
          ) : null
        }
        error={searchError ? "Player not found." : null}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {shouldRenderPageSectionTabs(sectionTabs) ? (
            <PageSectionTabs
              tabs={sectionTabs}
              activeKey={normalizedSelectedTab}
              onChange={(tab) => {
                const nextTab = tab as LeaderboardTab;
                navigate({
                  to: "/leaderboard",
                  search: {
                    player: urlPlayer,
                    tab: normalizeLeaderboardTab(nextTab, isSignedIn),
                  },
                  replace: true,
                });
              }}
            />
          ) : null}

          {showBetsTab ? (
            shouldRenderBetsTab ? (
              <BetsLeaderboardTab userId={userId} />
            ) : (
              <div className="py-12 text-center text-accent animate-pulse">
                Loading...
              </div>
            )
          ) : (
            <StatsTab
              targetPlayerId={targetPlayerId}
              targetNickname={targetNickname}
              playerIds={friendIds}
            />
          )}
        </div>
      </div>
    </div>
  );
}
