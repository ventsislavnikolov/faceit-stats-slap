import type { DemoPlayerAnalytics, MatchPlayerStats } from "~/lib/types";

interface MatchAnalyticsScoreboardProps {
  demoPlayers: DemoPlayerAnalytics[];
  faceitPlayers: MatchPlayerStats[];
  onSelectPlayer: (playerId: string) => void;
  selectedPlayerId: string | null;
  teams: {
    faction1: { name: string; playerIds: string[] };
    faction2: { name: string; playerIds: string[] };
  };
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
        demoByPlayer={demoByPlayer}
        hasDemoData={hasDemoData}
        onSelectPlayer={onSelectPlayer}
        players={team1Players}
        selectedPlayerId={selectedPlayerId}
        teamName={teams.faction1.name}
      />
      <TeamTable
        demoByPlayer={demoByPlayer}
        hasDemoData={hasDemoData}
        onSelectPlayer={onSelectPlayer}
        players={team2Players}
        selectedPlayerId={selectedPlayerId}
        teamName={teams.faction2.name}
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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-surface-elevated px-3 py-2 font-medium text-text text-xs">
        {teamName}
      </div>

      {/* Header */}
      <div
        className="grid gap-1 border-border border-b px-3 py-1 text-[9px] text-text-dim"
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
            className={`grid w-full gap-1 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-elevated/50 ${
              isSelected ? "bg-accent/5 ring-1 ring-accent" : ""
            }`}
            key={p.playerId}
            onClick={() => onSelectPlayer(p.playerId)}
            style={{ gridTemplateColumns: gridCols }}
            type="button"
          >
            <span className="truncate font-medium text-text">{p.nickname}</span>
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
                <span className="text-center text-accent">
                  {demo.tradeKills}
                </span>
                <span className="text-center text-error/70">
                  {demo.untradedDeaths}
                </span>
                <span className="text-center font-medium text-text">
                  {demo.rws.toFixed(1)}
                </span>
                <span className="text-center text-text">
                  {demo.kastPercent == null
                    ? "-"
                    : `${Math.round(demo.kastPercent)}`}
                </span>
                <span
                  className={`text-center font-bold ${
                    (demo.rating ?? 0) >= 1.1
                      ? "text-accent"
                      : (demo.rating ?? 0) < 0.9
                        ? "text-error/70"
                        : "text-text"
                  }`}
                >
                  {demo.rating == null ? "-" : demo.rating.toFixed(2)}
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
