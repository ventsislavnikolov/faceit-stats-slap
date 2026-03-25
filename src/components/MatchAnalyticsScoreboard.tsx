import type { DemoPlayerAnalytics, MatchPlayerStats } from "~/lib/types";

interface MatchAnalyticsScoreboardProps {
  faceitPlayers: MatchPlayerStats[];
  demoPlayers: DemoPlayerAnalytics[];
  teams: {
    faction1: { name: string; playerIds: string[] };
    faction2: { name: string; playerIds: string[] };
  };
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
}

export function MatchAnalyticsScoreboard({
  faceitPlayers,
  demoPlayers,
  teams,
  selectedPlayerId,
  onSelectPlayer,
}: MatchAnalyticsScoreboardProps) {
  const faction1Set = new Set(teams.faction1.playerIds);
  const demoByPlayer = new Map(demoPlayers.map((p) => [p.playerId, p]));
  const hasDemoData = demoPlayers.length > 0;

  const team1Players = faceitPlayers
    .filter((p) => faction1Set.has(p.playerId))
    .sort((a, b) => b.kills - a.kills);
  const team2Players = faceitPlayers
    .filter((p) => !faction1Set.has(p.playerId))
    .sort((a, b) => b.kills - a.kills);

  return (
    <div className="space-y-3">
      <TeamTable
        teamName={teams.faction1.name}
        players={team1Players}
        demoByPlayer={demoByPlayer}
        hasDemoData={hasDemoData}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
      <TeamTable
        teamName={teams.faction2.name}
        players={team2Players}
        demoByPlayer={demoByPlayer}
        hasDemoData={hasDemoData}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}

function TeamTable({
  teamName,
  players,
  demoByPlayer,
  hasDemoData,
  selectedPlayerId,
  onSelectPlayer,
}: {
  teamName: string;
  players: MatchPlayerStats[];
  demoByPlayer: Map<string | undefined, DemoPlayerAnalytics>;
  hasDemoData: boolean;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
}) {
  const baseCols = "1fr 40px 40px 40px 48px 40px 44px";
  const demoCols = hasDemoData ? " 44px 44px 48px 44px 44px" : "";
  const gridCols = baseCols + demoCols;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-surface-elevated px-3 py-2 text-xs font-medium text-text">
        {teamName}
      </div>

      {/* Header */}
      <div
        className="grid gap-1 px-3 py-1 text-[9px] text-text-dim border-b border-border"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span>Player</span>
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
        <span className="text-center">HS%</span>
        {hasDemoData && (
          <>
            <span className="text-center">TK</span>
            <span className="text-center">UD</span>
            <span className="text-center">RWS</span>
            <span className="text-center">KAST</span>
            <span className="text-center">RTG</span>
          </>
        )}
      </div>

      {/* Rows */}
      {players.map((p) => {
        const demo = demoByPlayer.get(p.playerId);
        const isSelected = p.playerId === selectedPlayerId;

        return (
          <button
            key={p.playerId}
            type="button"
            onClick={() => onSelectPlayer(p.playerId)}
            className={`grid gap-1 px-3 py-1.5 text-xs w-full text-left hover:bg-surface-elevated/50 transition-colors ${
              isSelected ? "ring-1 ring-accent bg-accent/5" : ""
            }`}
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="text-text truncate font-medium">{p.nickname}</span>
            <span className="text-center text-text">{p.kills}</span>
            <span className="text-center text-text">{p.deaths}</span>
            <span className="text-center text-text">{p.assists}</span>
            <span
              className={`text-center font-bold ${
                p.kdRatio >= 1 ? "text-accent" : "text-error/70"
              }`}
            >
              {p.kdRatio.toFixed(2)}
            </span>
            <span className="text-center text-text">{Math.round(p.adr)}</span>
            <span className="text-center text-text">{p.hsPercent}%</span>
            {hasDemoData && demo && (
              <>
                <span className="text-center text-accent">{demo.tradeKills}</span>
                <span className="text-center text-error/70">{demo.untradedDeaths}</span>
                <span className="text-center text-text font-medium">
                  {demo.rws.toFixed(1)}
                </span>
                <span className="text-center text-text">
                  {demo.kastPercent != null ? `${Math.round(demo.kastPercent)}` : "-"}
                </span>
                <span className={`text-center font-bold ${
                  (demo.rating ?? 0) >= 1.1 ? "text-accent" :
                  (demo.rating ?? 0) < 0.9 ? "text-error/70" : "text-text"
                }`}>
                  {demo.rating != null ? demo.rating.toFixed(2) : "-"}
                </span>
              </>
            )}
            {hasDemoData && !demo && (
              <>
                <span className="text-center text-text-dim">-</span>
                <span className="text-center text-text-dim">-</span>
                <span className="text-center text-text-dim">-</span>
                <span className="text-center text-text-dim">-</span>
                <span className="text-center text-text-dim">-</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
