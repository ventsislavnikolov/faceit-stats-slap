import { Link } from "@tanstack/react-router";
import type { LiveMatch } from "~/lib/types";
import { MapBadge } from "./MapBadge";
import { useBettingPool } from "~/hooks/useBettingPool";
import { BettingPanel } from "~/components/BettingPanel";
import { useMatchStats } from "~/hooks/useMatchStats";
import { PostMatchScoreboard } from "./PostMatchScoreboard";
import { getLiveMatchTeamLabels } from "~/lib/live-match";

interface LiveMatchCardProps {
  match: LiveMatch;
  userId?: string | null;
  userCoins?: number;
}

export function LiveMatchCard({ match, userId, userCoins }: LiveMatchCardProps) {
  const { data: betData } = useBettingPool(match.matchId, userId ?? null);
  const isFinished = match.status === "FINISHED";
  const { data: matchStats } = useMatchStats(match.matchId, isFinished);

  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const labels = getLiveMatchTeamLabels(match);
  const isFriendFaction1 = match.friendFaction === "faction1";
  const showPartyBadge = match.friendIds.length >= 3;

  const friendWon = matchStats?.players.some(
    (p) => match.friendIds.includes(p.playerId) && p.result
  );

  const borderColor = isFinished
    ? "border-border"
    : "border-accent/20";
  const gradientFrom = isFinished
    ? "from-bg-elevated/50"
    : "from-accent/5";

  return (
    <div className={`bg-gradient-to-br ${gradientFrom} to-bg-card border ${borderColor} rounded-lg p-4 mb-4`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="text-text-muted text-xs font-bold">FINISHED</span>
          ) : (
            <span className="flex items-center gap-1 text-error text-xs">
              <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
              LIVE
            </span>
          )}
          <MapBadge map={match.map} />
          {showPartyBadge && (
            <span className="bg-accent/15 text-accent text-[10px] px-2 py-0.5 rounded font-semibold">
              Party ({match.friendIds.length})
            </span>
          )}
        </div>
        {isFinished && matchStats ? (
          <span className={`text-xs font-bold ${friendWon ? "text-accent" : "text-error"}`}>
            {friendWon ? "WIN" : "LOSS"}
          </span>
        ) : (
          <span className="text-text-muted text-xs">{match.status}</span>
        )}
      </div>

      {/* Score */}
      {isFinished ? (
        <div className="flex justify-center items-center gap-4 mb-1">
          <span className={`text-sm ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {labels.faction1}
          </span>
          <span className={`text-2xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction1}
          </span>
          <span className="text-text-dim text-sm">-</span>
          <span className={`text-2xl font-bold ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction2}
          </span>
          <span className={`text-sm ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {labels.faction2}
          </span>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-center gap-6 mb-3">
            <div className="text-center">
              <div className={`text-sm mb-1 ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {labels.faction1}
              </div>
              <div className={`text-3xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {match.score.faction1}
              </div>
            </div>
            <div className="text-text-dim text-lg">vs</div>
            <div className="text-center">
              <div className={`text-sm mb-1 ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {labels.faction2}
              </div>
              <div className={`text-3xl font-bold ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
                {match.score.faction2}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-1.5">
            {match.friendIds.map((id) => {
              const roster = [...f1.roster, ...f2.roster];
              const player = roster.find((p) => p.playerId === id);
              return (
                <span key={id} className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded">
                  {player?.nickname || id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Post-match scoreboard */}
      {isFinished && matchStats && (
        <PostMatchScoreboard
          matchId={match.matchId}
          friendIds={match.friendIds}
          players={matchStats.players}
        />
      )}

      {/* Betting panel */}
      {betData?.pool && (
        <BettingPanel
          pool={betData.pool}
          userBet={betData.userBet}
          userId={userId ?? null}
          userCoins={userCoins ?? 0}
          matchId={match.matchId}
        />
      )}

      {isFinished && (
        <Link
          to="/match/$matchId"
          params={{ matchId: match.matchId }}
          className="block text-center text-xs text-text-muted hover:text-accent mt-2 transition-colors"
        >
          View Details
        </Link>
      )}
    </div>
  );
}
