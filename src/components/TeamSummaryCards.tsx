import type { DemoPlayerAnalytics, DemoRoundAnalytics, DemoTeamAnalytics } from "~/lib/types";

interface TeamSummaryCardsProps {
  teams: DemoTeamAnalytics[];
  players: DemoPlayerAnalytics[];
  rounds: DemoRoundAnalytics[];
}

export function TeamSummaryCards({ teams, players, rounds }: TeamSummaryCardsProps) {
  if (teams.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {teams.map((team) => {
        const teamPlayers = players.filter((p) => p.teamKey === team.teamKey);
        const teamRounds = computeTeamRoundStats(team.teamKey, rounds);
        return (
          <TeamCard
            key={team.teamKey}
            team={team}
            players={teamPlayers}
            roundStats={teamRounds}
          />
        );
      })}
    </div>
  );
}

interface TeamRoundStats {
  longestWinStreak: number;
  longestLossStreak: number;
  ecoWins: number;
  ecoRoundsPlayed: number;
}

function computeTeamRoundStats(
  teamKey: string,
  rounds: DemoRoundAnalytics[],
): TeamRoundStats {
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWin = 0;
  let currentLoss = 0;
  let ecoWins = 0;
  let ecoRoundsPlayed = 0;

  for (const r of rounds) {
    const won = r.winnerTeamKey === teamKey;
    if (won) { currentWin++; currentLoss = 0; longestWinStreak = Math.max(longestWinStreak, currentWin); }
    else { currentLoss++; currentWin = 0; longestLossStreak = Math.max(longestLossStreak, currentLoss); }

    // Eco round detection: team is on eco, enemy is on full/force
    const isT = r.tTeamKey === teamKey;
    const teamBuy = isT ? r.tBuyType : r.ctBuyType;
    const enemyBuy = isT ? r.ctBuyType : r.tBuyType;
    if (teamBuy === "eco" && (enemyBuy === "full_buy" || enemyBuy === "force_buy") && !r.isPistolRound) {
      ecoRoundsPlayed++;
      if (won) ecoWins++;
    }
  }

  return { longestWinStreak, longestLossStreak, ecoWins, ecoRoundsPlayed };
}

function TeamCard({
  team,
  players,
  roundStats,
}: {
  team: DemoTeamAnalytics;
  players: DemoPlayerAnalytics[];
  roundStats: TeamRoundStats;
}) {
  const isWinner = team.roundsWon > team.roundsLost;
  const totalDeaths = players.reduce((s, p) => s + (p.deaths ?? 0), 0);
  const totalTradedDeaths = players.reduce((s, p) => s + (p.tradedDeaths ?? 0), 0);
  const tradeRate = totalDeaths > 0 ? Math.round((totalTradedDeaths / totalDeaths) * 100) : 0;
  const totalUtilDamage = players.reduce((s, p) => s + (p.utilityDamage ?? 0), 0);
  const totalOpeningAttempts = players.reduce((s, p) => s + (p.openingDuelAttempts ?? 0), 0);
  const totalOpeningWins = players.reduce((s, p) => s + (p.openingDuelWins ?? 0), 0);
  const odWinRate = totalOpeningAttempts > 0 ? Math.round((totalOpeningWins / totalOpeningAttempts) * 100) : 0;
  const totalFlashAssists = players.reduce((s, p) => s + (p.flashAssists ?? 0), 0);
  const totalEnemiesFlashed = players.reduce((s, p) => s + (p.enemiesFlashed ?? 0), 0);

  return (
    <div
      className={`border rounded-lg p-3 ${
        isWinner ? "border-accent/30 bg-accent/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text">{team.name}</span>
        <span className="text-[10px] text-text-dim">
          {team.side !== "unknown" ? `${team.side} start` : ""}
        </span>
      </div>

      <div className="text-2xl font-bold text-text mb-3">
        {team.roundsWon}
        <span className="text-sm text-text-dim font-normal"> - {team.roundsLost}</span>
      </div>

      {/* Trading */}
      <SectionLabel label="Trading" />
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <StatRow label="Trade rate" value={`${tradeRate}%`} accent={tradeRate >= 50} />
        <StatRow label="Trade kills" value={team.tradeKills} />
        <StatRow label="Untraded" value={team.untradedDeaths} negative />
      </div>

      {/* Opening duels */}
      <SectionLabel label="Opening duels" />
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <StatRow label="OD win%" value={`${odWinRate}%`} accent={odWinRate >= 50} />
        <StatRow label="Entry kills" value={totalOpeningWins} />
        <StatRow label="Entry deaths" value={totalOpeningAttempts - totalOpeningWins} />
      </div>

      {/* Utility */}
      <SectionLabel label="Utility" />
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <StatRow label="Util DMG" value={totalUtilDamage} />
        <StatRow label="Flash assists" value={totalFlashAssists} />
        <StatRow label="Flashed" value={totalEnemiesFlashed} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <StatRow label="Total thrown" value={
          players.reduce((s, p) => s + (p.smokesThrown ?? 0) + (p.flashesThrown ?? 0) + (p.hesThrown ?? 0) + (p.molotovsThrown ?? 0), 0)
        } />
        <StatRow label="Team flashes" value={
          players.reduce((s, p) => s + (p.teamFlashes ?? 0), 0)
        } negative />
        <StatRow label="Avg blind" value={
          (() => {
            const durations = players.map(p => p.avgFlashBlindDuration ?? 0).filter(d => d > 0);
            return durations.length > 0 ? `${(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1)}s` : "-";
          })()
        } />
      </div>

      {/* Momentum */}
      <SectionLabel label="Momentum" />
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <StatRow label="Best streak" value={`${roundStats.longestWinStreak}W`} />
        <StatRow label="Worst streak" value={`${roundStats.longestLossStreak}L`} negative={roundStats.longestLossStreak >= 3} />
        <StatRow
          label="Eco wins"
          value={roundStats.ecoRoundsPlayed > 0 ? `${roundStats.ecoWins}/${roundStats.ecoRoundsPlayed}` : "-"}
        />
      </div>

      {/* RWS */}
      <div className="border-t border-border pt-2 mt-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-dim">Avg RWS</span>
          <span className="text-text font-medium">{team.rws.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[8px] text-text-dim uppercase tracking-wider mb-1 mt-1">{label}</div>
  );
}

function StatRow({
  label,
  value,
  accent,
  negative,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  negative?: boolean;
}) {
  let color = "text-text";
  if (accent) color = "text-accent";
  if (negative) color = "text-error/70";

  return (
    <div>
      <div className="text-text-dim">{label}</div>
      <div className={`font-medium ${color}`}>{value}</div>
    </div>
  );
}
