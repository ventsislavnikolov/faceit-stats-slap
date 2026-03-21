import type { LiveMatch } from "~/lib/types";
import { MapBadge } from "./MapBadge";

interface LiveMatchCardProps {
  match: LiveMatch;
}

export function LiveMatchCard({ match }: LiveMatchCardProps) {
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const isFriendFaction1 = match.friendFaction === "faction1";

  return (
    <div className="bg-gradient-to-br from-accent/5 to-bg-card border border-accent/20 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-error text-xs">
            <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
            LIVE
          </span>
          <MapBadge map={match.map} />
        </div>
        <span className="text-text-muted text-xs">{match.status}</span>
      </div>

      <div className="flex justify-center items-center gap-6 mb-3">
        <div className="text-center">
          <div className={`text-sm mb-1 ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f1.name}
          </div>
          <div className={`text-3xl font-bold ${isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {match.score.faction1}
          </div>
        </div>
        <div className="text-text-dim text-lg">vs</div>
        <div className="text-center">
          <div className={`text-sm mb-1 ${!isFriendFaction1 ? "text-accent" : "text-error/70"}`}>
            {f2.name}
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
    </div>
  );
}
