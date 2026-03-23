import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useLeaderboard } from "~/hooks/useLeaderboard";
import { useStatsLeaderboard } from "~/hooks/useStatsLeaderboard";
import { useSyncPlayerHistory } from "~/hooks/useSyncPlayerHistory";
import { MY_FACEIT_ID } from "~/lib/constants";
import {
  getStatsLeaderboardEmptyStateCopy,
  getStatsLeaderboardSummaryCopy,
} from "~/lib/stats-leaderboard-copy";
import {
  buildStatsLeaderboardSyncKey,
  buildStatsLeaderboardSyncPlayerIds,
  shouldAutoSyncStatsLeaderboard,
} from "~/lib/stats-leaderboard-sync";
import { searchAndLoadFriends } from "~/server/friends";
import { useEffect, useRef, useState } from "react";
import type { StatsLeaderboardEntry } from "~/lib/types";

const getCurrentUserId = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.user.id ?? null;
  });

export const Route = createFileRoute("/_authed/leaderboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    player: (search.player as string) || undefined,
  }),
  component: LeaderboardPage,
});

type Tab = "stats" | "bets";
type SortKey = "avgKills" | "avgKd" | "avgAdr" | "winRate" | "avgHsPercent" | "avgKrRatio" | "gamesPlayed"
  | "avgFirstKills" | "avgClutchKills" | "avgUtilityDamage" | "avgEnemiesFlashed" | "avgEntryRate" | "avgSniperKills";
type SortDir = "asc" | "desc";
type StatGroup = "combat" | "entry" | "utility";

const STAT_GROUPS: { key: StatGroup; label: string }[] = [
  { key: "combat", label: "Combat" },
  { key: "entry", label: "Entry & Clutch" },
  { key: "utility", label: "Utility & Flash" },
];

const STATS_COLS: Record<StatGroup, { key: SortKey; label: string; decimals: number; suffix?: string }[]> = {
  combat: [
    { key: "avgKills",     label: "Kills", decimals: 2 },
    { key: "avgKd",        label: "K/D",  decimals: 2 },
    { key: "avgAdr",       label: "ADR",  decimals: 1 },
    { key: "winRate",      label: "WIN%", decimals: 0, suffix: "%" },
    { key: "avgHsPercent", label: "HS%",  decimals: 0, suffix: "%" },
    { key: "avgKrRatio",   label: "K/R",  decimals: 2 },
  ],
  entry: [
    { key: "avgFirstKills",  label: "FK",   decimals: 2 },
    { key: "avgEntryRate",   label: "ER",   decimals: 2 },
    { key: "avgClutchKills", label: "CK",   decimals: 2 },
    { key: "avgSniperKills", label: "AWP",  decimals: 2 },
  ],
  utility: [
    { key: "avgUtilityDamage",  label: "UD",  decimals: 0 },
    { key: "avgEnemiesFlashed", label: "EF",  decimals: 1 },
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
}: {
  targetPlayerId: string;
  targetNickname: string;
  playerIds: string[];
}) {
  const [n, setN] = useState<20 | 50 | 100>(20);
  const [days, setDays] = useState<30 | 90 | 180 | 365 | 730>(30);
  const [sortKey, setSortKey] = useState<SortKey>("avgKd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statGroup, setStatGroup] = useState<StatGroup>("combat");
  const attemptedSyncKeysRef = useRef<Set<string>>(new Set());

  const { data: leaderboard, isLoading } = useStatsLeaderboard({
    targetPlayerId,
    playerIds,
    n,
    days,
  });
  const autoSync = useSyncPlayerHistory({
    targetPlayerId,
    playerIds: buildStatsLeaderboardSyncPlayerIds({ mode: "auto", playerIds }),
  });
  const manualSync = useSyncPlayerHistory({
    targetPlayerId,
    playerIds: buildStatsLeaderboardSyncPlayerIds({ mode: "manual", playerIds }),
  });

  const activeCols = STATS_COLS[statGroup];
  const entries = sortEntries(leaderboard?.entries ?? [], sortKey, sortDir);
  const summaryCopy = leaderboard
    ? getStatsLeaderboardSummaryCopy(targetNickname, leaderboard.sharedFriendCount, days, n)
    : null;
  const emptyStateCopy = leaderboard
    ? getStatsLeaderboardEmptyStateCopy({
        targetNickname,
        targetMatchCount: leaderboard.targetMatchCount,
        sharedFriendCount: leaderboard.sharedFriendCount,
        days,
      })
    : null;

  useEffect(() => {
    if (!shouldAutoSyncStatsLeaderboard({
      targetPlayerId,
      playerIds,
      n,
      days,
      isPending: autoSync.isPending,
      attemptedKeys: attemptedSyncKeysRef.current,
    })) {
      return;
    }

    const key = buildStatsLeaderboardSyncKey({ targetPlayerId, playerIds, n, days });
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span className="text-text-dim text-xs mr-1">Last</span>
          {([20, 50, 100] as const).map((v) => (
            <button
              key={v}
              onClick={() => setN(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                n === v ? "bg-accent text-black" : "bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {v}
            </button>
          ))}
          <span className="text-text-dim text-xs ml-1">games</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-dim text-xs mr-1">In the last</span>
          {([30, 90, 180, 365, 730] as const).map((v) => (
            <button
              key={v}
              onClick={() => setDays(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                days === v ? "bg-accent text-black" : "bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {v}
            </button>
          ))}
          <span className="text-text-dim text-xs ml-1">days</span>
        </div>
        <button
          onClick={() => manualSync.mutate({ n, days })}
          disabled={manualSync.isPending || !targetPlayerId}
          className="text-xs px-3 py-1 rounded bg-bg-elevated text-text-muted hover:text-text disabled:opacity-50 transition-colors"
        >
          {manualSync.isPending ? "Syncing..." : "↻ Refresh"}
        </button>
      </div>

      {autoSync.isPending && !manualSync.isPending && (
        <div className="text-[10px] text-text-dim px-1">
          Syncing older history in the background...
        </div>
      )}

      <div className="flex items-center gap-1">
        {STAT_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setStatGroup(g.key);
              setSortKey(STATS_COLS[g.key][0].key);
              setSortDir("desc");
            }}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              statGroup === g.key ? "bg-accent text-black" : "bg-bg-elevated text-text-muted hover:text-text"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {!targetPlayerId ? (
        <div className="text-text-dim text-center py-12">
          Search a player above to see who they queued with recently and how each friend is performing across their own recent matches
        </div>
      ) : isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          {summaryCopy && (
            <div className="text-xs text-text-dim px-3">
              {summaryCopy}
            </div>
          )}
          {emptyStateCopy && (
            <div className="text-text-dim text-center py-12 text-sm">
              {emptyStateCopy}
            </div>
          )}

          {!emptyStateCopy && (
            <>
              <div
                className="grid gap-2 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
                style={{ gridTemplateColumns: `2rem 1fr 3rem repeat(${activeCols.length}, 4rem)` }}
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
                    {sortKey === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                ))}
              </div>

              {entries.map((entry, i) => {
                const isMe = entry.faceitId === MY_FACEIT_ID;
                return (
                  <div
                    key={entry.faceitId}
                    className={`grid gap-2 items-center px-3 py-2 rounded text-sm ${
                      isMe
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "bg-bg-elevated"
                    }`}
                    style={{ gridTemplateColumns: `2rem 1fr 3rem repeat(${activeCols.length}, 4rem)` }}
                  >
                    <span className={`text-xs font-bold ${rankColor(i)}`}>{i + 1}</span>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className={`font-bold truncate ${isMe ? "text-accent" : "text-text"}`}>
                        {isMe ? "You" : entry.nickname}
                      </span>
                      {entry.elo > 0 && (
                        <span className="text-text-dim text-[10px] shrink-0">{entry.elo}</span>
                      )}
                    </div>
                    <span className="text-right text-text-muted text-xs">
                      {entry.gamesPlayed || "—"}
                    </span>
                    {activeCols.map((col) => (
                      <span
                        key={col.key}
                        className={`text-right text-xs ${
                          sortKey === col.key ? "text-accent font-semibold" : "text-text-muted"
                        }`}
                      >
                        {fmt(entry[col.key], col.decimals, col.suffix)}
                      </span>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BetsTab() {
  const { data: entries = [], isLoading } = useLeaderboard();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  return (
    <>
      {isLoading ? (
        <div className="text-accent animate-pulse text-center py-8">Loading...</div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 text-[10px] text-text-dim uppercase tracking-wider px-3 pb-1">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Coins</span>
            <span className="text-right">Bets</span>
            <span className="text-right">Won</span>
            <span className="text-right">Win%</span>
          </div>
          {entries.map((entry, i) => {
            const winRate =
              entry.betsPlaced > 0
                ? Math.round((entry.betsWon / entry.betsPlaced) * 100)
                : 0;
            const isMe = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className={`grid grid-cols-[2rem_1fr_6rem_4rem_4rem_4rem] gap-2 items-center px-3 py-2 rounded text-sm ${
                  isMe ? "bg-accent/10 border border-accent/30" : "bg-bg-elevated"
                }`}
              >
                <span
                  className={`text-xs ${i < 3 ? "text-accent font-bold" : "text-text-dim"}`}
                >
                  {i + 1}
                </span>
                <span className={`truncate font-bold ${isMe ? "text-accent" : "text-text"}`}>
                  {entry.nickname}
                </span>
                <span className="text-right text-accent font-bold">
                  🪙 {entry.coins.toLocaleString()}
                </span>
                <span className="text-right text-text-muted">{entry.betsPlaced}</span>
                <span className="text-right text-text-muted">{entry.betsWon}</span>
                <span
                  className={`text-right ${winRate >= 50 ? "text-accent" : "text-text-muted"}`}
                >
                  {entry.betsPlaced > 0 ? `${winRate}%` : "—"}
                </span>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-text-dim text-center py-12 text-sm">
              No players yet — place the first bet!
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LeaderboardPage() {
  const { player: urlPlayer } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("stats");
  const [input, setInput] = useState(urlPlayer ?? "");
  const [search, setSearch] = useState<string | null>(urlPlayer ?? null);

  const {
    data: searchResult,
    isLoading: searchLoading,
    isError: searchError,
  } = useQuery({
    queryKey: ["friends-search", search?.toLowerCase()],
    queryFn: () => searchAndLoadFriends({ data: search! }),
    enabled: !!search,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const friendIds = searchResult?.friends.map((f) => f.faceitId) ?? [];
  const targetPlayerId = searchResult?.player.faceitId ?? "";
  const targetNickname = searchResult?.player.nickname ?? "";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setSearch(trimmed);
  };

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Leaderboard</h2>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="FACEIT nickname or UUID"
          className="flex-1 bg-bg-elevated text-text text-xs px-3 py-2 rounded border border-border focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={searchLoading}
          className="text-xs px-4 py-2 rounded bg-accent text-bg font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {searchLoading ? "..." : "Search"}
        </button>
      </form>

      {searchResult && (
        <div className="text-xs text-text-muted mb-4">
          Showing leaderboard for <span className="text-accent font-bold">{searchResult.player.nickname}</span>
        </div>
      )}
      {searchError && (
        <div className="text-error text-xs mb-4">Player not found</div>
      )}

      <div className="flex border-b border-border mb-6">
        {(["stats", "bets"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t === "stats" ? "Stats" : "Bets"}
          </button>
        ))}
      </div>

      {tab === "stats" ? (
        <StatsTab
          targetPlayerId={targetPlayerId}
          targetNickname={targetNickname}
          playerIds={friendIds}
        />
      ) : (
        <BetsTab />
      )}
    </div>
  );
}
