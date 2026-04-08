import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageSectionTabs } from "~/components/PageSectionTabs";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";
import { useTrackedPlayerTarget } from "~/hooks/useTrackedPlayerTarget";
import { useStatsLeaderboard } from "~/hooks/useStatsLeaderboard";
import { useSyncPlayerHistory } from "~/hooks/useSyncPlayerHistory";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  type HistoryMatchCount,
  type LeaderboardDays,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
  normalizeLeaderboardDays,
} from "~/lib/history-page";
import { buildTrackedPlayerSearch } from "~/lib/tracked-route";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";
import {
  buildStatsLeaderboardSyncKey,
  buildStatsLeaderboardSyncPlayerIds,
  shouldAutoSyncStatsLeaderboard,
} from "~/lib/stats-leaderboard-sync";
import type { StatsLeaderboardEntry } from "~/lib/types";
import { searchAndLoadFriends } from "~/server/friends";

export const Route = createFileRoute("/_authed/leaderboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    player: (search.player as string) || undefined,
    resolvedPlayerId:
      typeof search.resolvedPlayerId === "string" &&
      search.resolvedPlayerId.length > 0
        ? search.resolvedPlayerId
        : undefined,
    matches: normalizeHistoryMatchCount(search.matches),
    queue: normalizeHistoryQueueFilter(search.queue),
    last: normalizeLeaderboardDays(search.last),
  }),
  component: LeaderboardPage,
});

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
  {
    key: SortKey;
    label: string;
    decimals: number;
    suffix?: string;
    tooltip?: string;
  }[]
> = {
  combat: [
    {
      key: "avgImpact",
      label: "Impact",
      decimals: 1,
      tooltip: "Composite impact rating per match",
    },
    {
      key: "avgKills",
      label: "Kills",
      decimals: 2,
      tooltip: "Average kills per match",
    },
    {
      key: "avgKd",
      label: "K/D",
      decimals: 2,
      tooltip: "Average Kill/Death ratio",
    },
    {
      key: "avgAdr",
      label: "ADR",
      decimals: 1,
      tooltip: "Average Damage per Round",
    },
    {
      key: "winRate",
      label: "WIN%",
      decimals: 0,
      suffix: "%",
      tooltip: "Win rate percentage",
    },
    {
      key: "avgHsPercent",
      label: "HS%",
      decimals: 0,
      suffix: "%",
      tooltip: "Average headshot percentage",
    },
    {
      key: "avgKrRatio",
      label: "K/R",
      decimals: 2,
      tooltip: "Average Kill/Round ratio",
    },
  ],
  entry: [
    {
      key: "avgFirstKills",
      label: "FK",
      decimals: 2,
      tooltip: "Average first kills per match",
    },
    {
      key: "avgEntryRate",
      label: "ER",
      decimals: 2,
      tooltip: "Average entry rate — opening duel win ratio",
    },
    {
      key: "avgClutchKills",
      label: "CK",
      decimals: 2,
      tooltip: "Average clutch kills per match",
    },
    {
      key: "avgSniperKills",
      label: "AWP",
      decimals: 2,
      tooltip: "Average AWP kills per match",
    },
  ],
  utility: [
    {
      key: "avgUtilityDamage",
      label: "UD",
      decimals: 0,
      tooltip: "Average utility damage per match",
    },
    {
      key: "avgEnemiesFlashed",
      label: "EF",
      decimals: 1,
      tooltip: "Average enemies flashed per match",
    },
  ],
};

function fmt(val: number, decimals: number, suffix = "") {
  return val === 0 ? "—" : `${val.toFixed(decimals)}${suffix}`;
}

function sortEntries(
  entries: StatsLeaderboardEntry[],
  key: SortKey,
  dir: SortDir
): StatsLeaderboardEntry[] {
  return [...entries].sort((a, b) =>
    dir === "desc" ? b[key] - a[key] : a[key] - b[key]
  );
}

function StatsTab({
  targetPlayerId,
  targetNickname,
  playerIds,
  hasSearchTarget,
  isResolvingTarget,
  n,
  days,
  queue,
  onUpdateSearch,
}: {
  targetPlayerId: string;
  targetNickname: string;
  playerIds: string[];
  hasSearchTarget: boolean;
  isResolvingTarget: boolean;
  n: HistoryMatchCount;
  days: LeaderboardDays;
  queue: "all" | "solo" | "party";
  onUpdateSearch: (next: {
    matches?: HistoryMatchCount;
    queue?: "all" | "solo" | "party";
    last?: LeaderboardDays;
  }) => void;
}) {
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
        queue
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

  const settingsBar = (
    <>
      <div className="flex flex-wrap items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-dim">Last</span>
          <div className="flex gap-1">
            {getHistoryMatchCountOptions().map((option) => (
              <button
                className={`rounded px-3 py-1.5 transition-colors ${n === option.value ? "bg-accent font-bold text-bg" : "bg-bg-elevated text-text-muted hover:text-text"}`}
                key={option.value}
                onClick={() => onUpdateSearch({ matches: option.value })}
                type="button"
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
                className={`rounded px-3 py-1.5 transition-colors ${queue === option.value ? "bg-accent font-bold text-bg" : "bg-bg-elevated text-text-muted hover:text-text"}`}
                key={option.value}
                onClick={() => onUpdateSearch({ queue: option.value })}
                type="button"
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
                className={`rounded px-3 py-1.5 transition-colors ${days === v ? "bg-accent font-bold text-bg" : "bg-bg-elevated text-text-muted hover:text-text"}`}
                key={v}
                onClick={() => onUpdateSearch({ last: v })}
                type="button"
              >
                {v}
              </button>
            ))}
          </div>
          <span className="text-text-dim">days</span>
        </div>
        <button
          className="rounded bg-bg-elevated px-3 py-1.5 text-text-muted text-xs transition-colors hover:text-text disabled:opacity-50"
          disabled={manualSync.isPending || !targetPlayerId}
          onClick={() => manualSync.mutate({ n, days })}
          type="button"
        >
          {manualSync.isPending ? "Syncing..." : "↻ Refresh"}
        </button>
      </div>
      <div className="text-[10px] text-text-dim">
        Party means the player plus at least 2 known FACEIT friends in the same
        match.
      </div>
    </>
  );

  const leaderboardTable = (
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
        <span className="group/hdr relative cursor-help text-right">
          GP
          <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-bg-card px-2 py-1 font-normal text-[9px] text-text normal-case tracking-normal shadow-lg group-hover/hdr:block">
            Games played
          </span>
        </span>
        {activeCols.map((col) => (
          <button
            className={`group/col relative text-right transition-colors hover:text-text ${sortKey === col.key ? "text-accent" : ""}`}
            key={col.key}
            onClick={() => handleSort(col.key)}
            type="button"
          >
            {col.label}
            {sortKey === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
            {col.tooltip && (
              <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-bg-card px-2 py-1 font-normal text-[9px] text-text normal-case tracking-normal shadow-lg group-hover/col:block">
                {col.tooltip}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        className="flex flex-col gap-1"
        style={{ minWidth: leaderboardMinWidth }}
      >
        {entries.map((entry, i) => {
          const isMe = entry.faceitId === targetPlayerId;
          return (
            <div
              className={`grid items-center gap-2 rounded px-3 py-2 text-sm ${isMe ? "border-accent border-l-2 bg-accent/10" : "bg-bg-elevated"}`}
              key={entry.faceitId}
              style={{ gridTemplateColumns: leaderboardGridTemplate }}
            >
              <span className={`font-bold text-xs ${rankColor(i)}`}>
                {i + 1}
              </span>
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}
                >
                  {entry.nickname}
                </span>
                {entry.elo > 0 && (
                  <span className="shrink-0 text-[10px] text-text-dim">
                    {entry.elo}
                  </span>
                )}
              </div>
              <span className="text-right text-text-muted text-xs">
                {entry.gamesPlayed || "—"}
              </span>
              {activeCols.map((col) => (
                <span
                  className={`text-right text-xs ${sortKey === col.key ? "font-semibold text-accent" : "text-text-muted"}`}
                  key={col.key}
                >
                  {fmt(entry[col.key], col.decimals, col.suffix)}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {settingsBar}
      {summaryCopy && (
        <div className="text-[10px] text-text-dim">{summaryCopy}</div>
      )}
      {autoSync.isPending && !manualSync.isPending && (
        <div className="text-[10px] text-text-dim">
          Syncing older history in the background...
        </div>
      )}
      <PageSectionTabs
        activeKey={statGroup}
        onChange={(key) => {
          const group = key as StatGroup;
          setStatGroup(group);
          setSortKey(STATS_COLS[group][0].key);
          setSortDir("desc");
        }}
        tabs={STAT_GROUPS.map((group) => ({
          key: group.key,
          label: group.label,
        }))}
      />
      {isResolvingTarget ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="grid items-center gap-2 rounded bg-bg-elevated px-3 py-2"
              key={i}
              style={{ gridTemplateColumns: "3rem 1fr 4rem repeat(7, 5rem)" }}
            >
              <div className="h-3 w-6 animate-pulse rounded bg-border" />
              <div className="flex items-baseline gap-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-border" />
                <div className="h-2 w-8 animate-pulse rounded bg-border" />
              </div>
              <div className="ml-auto h-3 w-6 animate-pulse rounded bg-border" />
              {Array.from({ length: 7 }).map((_, j) => (
                <div
                  className="ml-auto h-3 w-10 animate-pulse rounded bg-border"
                  key={j}
                />
              ))}
            </div>
          ))}
        </div>
      ) : targetPlayerId || hasSearchTarget ? (
        isLoading ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="grid items-center gap-2 rounded bg-bg-elevated px-3 py-2"
                key={i}
                style={{ gridTemplateColumns: "3rem 1fr 4rem repeat(7, 5rem)" }}
              >
                <div className="h-3 w-6 animate-pulse rounded bg-border" />
                <div className="flex items-baseline gap-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-border" />
                  <div className="h-2 w-8 animate-pulse rounded bg-border" />
                </div>
                <div className="ml-auto h-3 w-6 animate-pulse rounded bg-border" />
                {Array.from({ length: 7 }).map((_, j) => (
                  <div
                    className="ml-auto h-3 w-10 animate-pulse rounded bg-border"
                    key={j}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-1">
            {emptyStateCopy && (
              <div className="py-12 text-center text-sm text-text-dim">
                {emptyStateCopy}
              </div>
            )}
            {!emptyStateCopy && leaderboardTable}
          </div>
        )
      ) : (
        <div className="py-12 text-center text-text-dim">
          Search a player above to see how their friends are performing across
          their own recent matches
        </div>
      )}
    </div>
  );
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const {
    player: urlPlayer,
    resolvedPlayerId,
    matches: selectedMatchCount,
    queue: selectedQueue,
    last: selectedDays,
  } = Route.useSearch();
  const [input, setInput] = useState(urlPlayer ?? "");

  const {
    data: targetPlayer,
    isLoading: searchLoading,
    isError: searchError,
    isTrackedFlow,
  } = useTrackedPlayerTarget({
    page: "leaderboard",
    player: urlPlayer,
    resolvedPlayerId,
    matches: selectedMatchCount,
    queue: selectedQueue,
    last: selectedDays,
  });

  const targetPlayerId = targetPlayer?.faceitId ?? "";
  const targetNickname = targetPlayer?.nickname ?? "";

  const {
    data: searchResult,
    isLoading: searchResultLoading,
    isError: searchResultError,
  } = useQuery({
    queryKey: ["friends-search", targetPlayerId],
    queryFn: () => searchAndLoadFriends({ data: targetPlayerId! }),
    enabled: !!targetPlayerId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    setInput(urlPlayer ?? "");
  }, [urlPlayer]);

  useEffect(() => {
    if (
      !isTrackedFlow ||
      !targetPlayer?.faceitId ||
      !urlPlayer ||
      resolvedPlayerId === targetPlayer.faceitId
    ) {
      return;
    }

    navigate({
      to: "/leaderboard",
      replace: true,
      search: {
        ...buildTrackedPlayerSearch({
          currentPlayer: urlPlayer,
          currentResolvedPlayerId: resolvedPlayerId,
          nextResolvedPlayerId: targetPlayer.faceitId,
        }),
        matches: selectedMatchCount,
        queue: selectedQueue,
        last: selectedDays,
      },
    });
  }, [
    isTrackedFlow,
    navigate,
    resolvedPlayerId,
    selectedDays,
    selectedMatchCount,
    selectedQueue,
    targetPlayer?.faceitId,
    urlPlayer,
  ]);

  const friendIds = searchResult?.friends.map((f) => f.faceitId) ?? [];
  const hasSearchTarget = Boolean(urlPlayer);
  const hasTrackedPlayerMiss =
    isTrackedFlow &&
    hasSearchTarget &&
    !searchLoading &&
    !searchResultLoading &&
    !searchError &&
    !searchResultError &&
    !targetPlayerId;
  const isResolvingTarget =
    hasSearchTarget &&
    (searchLoading || searchResultLoading) &&
    !searchError &&
    !searchResultError &&
    !targetPlayerId;

  const updateSearch = (next: {
    player?: string;
    matches?: HistoryMatchCount;
    queue?: "all" | "solo" | "party";
    last?: LeaderboardDays;
  }) => {
    const nextPlayer = next.player ?? urlPlayer;
    navigate({
      to: "/leaderboard",
      search: {
        ...buildTrackedPlayerSearch({
          currentPlayer: urlPlayer,
          currentResolvedPlayerId: resolvedPlayerId,
          nextPlayer,
        }),
        matches: next.matches ?? selectedMatchCount,
        queue: next.queue ?? selectedQueue,
        last: next.last ?? selectedDays,
      },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) {
      return;
    }

    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    updateSearch({ player: target.value });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PlayerSearchHeader
        error={searchError || searchResultError ? "Player not found." : null}
        isSearching={searchLoading || searchResultLoading}
        onSubmit={handleSearch}
        onValueChange={setInput}
        placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
        value={input}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          {hasTrackedPlayerMiss ? (
            <div className="py-12 text-center text-text-dim">
              No tracked player has leaderboard data for these filters.
            </div>
          ) : (
            <StatsTab
              days={selectedDays}
              hasSearchTarget={hasSearchTarget}
              isResolvingTarget={isResolvingTarget}
              n={selectedMatchCount}
              onUpdateSearch={updateSearch}
              playerIds={friendIds}
              queue={selectedQueue}
              targetNickname={targetNickname}
              targetPlayerId={targetPlayerId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
