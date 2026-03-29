import { Link } from "@tanstack/react-router";
import { BettingPanel } from "~/components/BettingPanel";
import { useBettingPool } from "~/hooks/useBettingPool";
import { useMatchStats } from "~/hooks/useMatchStats";
import {
  getLiveMatchDisplayScore,
  getLiveMatchTeamLabels,
} from "~/lib/live-match";
import type { LiveMatch } from "~/lib/types";
import { LiveScoreboard } from "./LiveScoreboard";
import { MapBadge } from "./MapBadge";
import { PostMatchScoreboard } from "./PostMatchScoreboard";

interface LiveMatchCardProps {
  authResolved?: boolean;
  bettingContextReady?: boolean;
  match: LiveMatch;
  seasonId?: string | null;
  userCoins?: number;
  userId?: string | null;
}

export function LiveMatchCard({
  match,
  authResolved = true,
  bettingContextReady = true,
  seasonId,
  userId,
  userCoins,
}: LiveMatchCardProps) {
  const { data: betData } = useBettingPool(match.matchId, userId ?? null);
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "ONGOING";
  const { data: matchStats } = useMatchStats(match.matchId, {
    enabled: isFinished || isLive,
    live: isLive,
  });

  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const labels = getLiveMatchTeamLabels(match);
  const displayScore = getLiveMatchDisplayScore(match, matchStats);
  const isFriendFaction1 = match.friendFaction === "faction1";
  const showPartyBadge = match.friendIds.length >= 3;

  const friendWon = matchStats?.players.some(
    (p) => match.friendIds.includes(p.playerId) && p.result
  );

  const borderColor = isFinished ? "border-border" : "border-accent/20";
  const gradientFrom = isFinished ? "from-bg-elevated/50" : "from-accent/5";

  return (
    <div
      className={`bg-gradient-to-br ${gradientFrom} border to-bg-card ${borderColor} mb-4 rounded-lg p-4`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="font-bold text-text-muted text-xs">FINISHED</span>
          ) : (
            <span className="flex items-center gap-1 text-error text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
              LIVE
            </span>
          )}
          <MapBadge map={match.map} />
          {showPartyBadge && (
            <span className="rounded bg-accent/15 px-2 py-0.5 font-semibold text-[10px] text-accent">
              Party ({match.friendIds.length})
            </span>
          )}
        </div>
        {isFinished && matchStats ? (
          <span
            className={`font-bold text-xs ${friendWon ? "text-accent" : "text-error"}`}
          >
            {friendWon ? "WIN" : "LOSS"}
          </span>
        ) : (
          <span className="text-text-muted text-xs">{match.status}</span>
        )}
      </div>

      {/* Score */}
      {isFinished ? (
        <div className="mb-1 flex items-center justify-center gap-4">
          <span
            className={`text-sm ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}
          >
            {labels.faction1}
          </span>
          <span
            className={`font-bold text-2xl ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}
          >
            {displayScore.faction1}
          </span>
          <span className="text-sm text-text-dim">-</span>
          <span
            className={`font-bold text-2xl ${isFriendFaction1 ? "text-error/70" : "text-accent"}`}
          >
            {displayScore.faction2}
          </span>
          <span
            className={`text-sm ${isFriendFaction1 ? "text-error/70" : "text-accent"}`}
          >
            {labels.faction2}
          </span>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-6">
            <div className="text-center">
              <div
                className={`mb-1 text-sm ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}
              >
                {labels.faction1}
              </div>
              <div
                className={`font-bold text-3xl ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}
              >
                {displayScore.faction1}
              </div>
            </div>
            <div className="text-lg text-text-dim">vs</div>
            <div className="text-center">
              <div
                className={`mb-1 text-sm ${isFriendFaction1 ? "text-error/70" : "text-accent"}`}
              >
                {labels.faction2}
              </div>
              <div
                className={`font-bold text-3xl ${isFriendFaction1 ? "text-error/70" : "text-accent"}`}
              >
                {displayScore.faction2}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-1.5">
            {match.friendIds.map((id) => {
              const roster = [...f1.roster, ...f2.roster];
              const player = roster.find((p) => p.playerId === id);
              return (
                <span
                  className="rounded bg-accent/15 px-2 py-0.5 text-accent text-xs"
                  key={id}
                >
                  {player?.nickname || id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        </>
      )}

      {!isFinished && matchStats && matchStats.players.length > 0 && (
        <LiveScoreboard
          friendIds={match.friendIds}
          players={matchStats.players}
        />
      )}

      {/* Post-match scoreboard */}
      {isFinished && matchStats && (
        <PostMatchScoreboard
          friendIds={match.friendIds}
          matchId={match.matchId}
          players={matchStats.players}
        />
      )}

      {/* Betting panel */}
      {authResolved && bettingContextReady && betData?.pool && seasonId && (
        <BettingPanel
          matchId={match.matchId}
          pool={betData.pool}
          seasonId={seasonId}
          userBet={betData.userBet}
          userCoins={userCoins ?? 0}
          userId={userId ?? null}
        />
      )}

      {isFinished && (
        <Link
          className="mt-2 block text-center text-text-muted text-xs transition-colors hover:text-accent"
          params={{ matchId: match.matchId }}
          to="/match/$matchId"
        >
          View Details
        </Link>
      )}
    </div>
  );
}
