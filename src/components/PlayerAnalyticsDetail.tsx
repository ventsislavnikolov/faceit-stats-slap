import type { DemoPlayerAnalytics, MatchPlayerStats } from "~/lib/types";

interface PlayerAnalyticsDetailProps {
  faceitPlayer: MatchPlayerStats | null;
  demoPlayer: DemoPlayerAnalytics | null;
  totalRounds?: number;
}

export function PlayerAnalyticsDetail({
  faceitPlayer,
  demoPlayer,
  totalRounds = 0,
}: PlayerAnalyticsDetailProps) {
  if (!faceitPlayer) {
    return (
      <div className="border border-border rounded-lg p-4 text-center text-xs text-text-dim">
        Select a player to view detailed analytics
      </div>
    );
  }

  const d = demoPlayer;
  const kills = d?.kills ?? faceitPlayer.kills;
  const deaths = d?.deaths ?? faceitPlayer.deaths;
  const impactKills = kills - (d?.exitKills ?? 0);
  const exitPercent = kills > 0 ? Math.round(((d?.exitKills ?? 0) / kills) * 100) : 0;
  const tradeKillPercent = kills > 0 ? Math.round((d?.tradeKills ?? 0) / kills * 100) : 0;
  const tradedDeathPercent = deaths > 0 ? Math.round(((d?.tradedDeaths ?? 0) / deaths) * 100) : 0;
  const damagePerKill = kills > 0 ? Math.round((d?.damage ?? faceitPlayer.damage) / kills) : 0;
  const utilityAdr = totalRounds > 0 ? ((d?.utilityDamage ?? 0) / totalRounds).toFixed(1) : "0";

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{faceitPlayer.nickname}</span>
          {d?.rating != null && <RatingBadge rating={d.rating} />}
        </div>
        <span className="text-[10px] text-text-dim">Player detail</span>
      </div>

      {/* Core stats */}
      <SectionLabel label="Core stats" />
      <div className="grid grid-cols-6 gap-2 mb-3">
        <StatBlock label="K/D/A" value={`${kills}/${deaths}/${d?.assists ?? faceitPlayer.assists}`} />
        <StatBlock label="K/D" value={faceitPlayer.kdRatio.toFixed(2)} accent={faceitPlayer.kdRatio >= 1} />
        <StatBlock label="ADR" value={Math.round(d?.adr ?? faceitPlayer.adr).toString()} />
        <StatBlock label="HS%" value={`${d?.hsPercent ?? faceitPlayer.hsPercent}%`} />
        <StatBlock label="KAST%" value={d?.kastPercent != null ? `${d.kastPercent}%` : "-"} accent={(d?.kastPercent ?? 0) >= 70} />
        <StatBlock label="DMG/Kill" value={String(damagePerKill)} />
      </div>

      {d && (
        <>
          {/* Kill breakdown */}
          <SectionLabel label="Kill breakdown" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Impact kills" value={String(impactKills)} accent />
            <StatBlock label="Exit kills" value={String(d.exitKills ?? 0)} negative={(d.exitKills ?? 0) > 0} />
            <StatBlock label="Exit %" value={`${exitPercent}%`} negative={exitPercent > 15} />
            <StatBlock label="Trade kills" value={String(d.tradeKills)} accent />
            <StatBlock label="TK %" value={`${tradeKillPercent}%`} />
            <StatBlock label="HS" value={String(d.headshots ?? 0)} />
          </div>

          {/* Death breakdown */}
          <SectionLabel label="Death breakdown" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Deaths" value={String(deaths)} />
            <StatBlock label="Traded" value={String(d.tradedDeaths)} accent />
            <StatBlock label="Traded %" value={`${tradedDeathPercent}%`} accent={tradedDeathPercent >= 50} />
            <StatBlock label="Untraded" value={String(d.untradedDeaths)} negative />
            <StatBlock label="Entry deaths" value={String(d.entryDeaths ?? 0)} />
            <StatBlock label="Last alive" value={String(d.lastAliveRounds ?? 0)} />
          </div>

          {/* Opening duels */}
          <SectionLabel label="Opening duels" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Entry kills" value={String(d.entryKills ?? 0)} />
            <StatBlock label="Entry deaths" value={String(d.entryDeaths ?? 0)} />
            <StatBlock
              label="OD win%"
              value={(d.openingDuelAttempts ?? 0) > 0
                ? `${Math.round(((d.openingDuelWins ?? 0) / d.openingDuelAttempts!) * 100)}%`
                : "-"}
              accent={(d.openingDuelWins ?? 0) > (d.entryDeaths ?? 0)}
            />
            <StatBlock label="OD attempts" value={String(d.openingDuelAttempts ?? 0)} />
            <StatBlock label="First kills" value={faceitPlayer.firstKills.toString()} />
            <StatBlock label="" value="" />
          </div>

          {/* Clutch & survival */}
          <SectionLabel label="Clutch & survival" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Clutch W/A" value={`${d.clutchWins ?? 0}/${d.clutchAttempts ?? 0}`} accent={(d.clutchWins ?? 0) > 0} />
            <StatBlock
              label="Clutch %"
              value={(d.clutchAttempts ?? 0) > 0
                ? `${Math.round(((d.clutchWins ?? 0) / d.clutchAttempts!) * 100)}%`
                : "-"}
            />
            <StatBlock label="RWS" value={d.rws.toFixed(1)} accent />
            <StatBlock label="Plants" value={String(d.bombPlants ?? 0)} />
            <StatBlock label="Defuses" value={String(d.bombDefuses ?? 0)} />
            <StatBlock label="MVPs" value={faceitPlayer.mvps.toString()} />
          </div>

          {/* Utility */}
          <SectionLabel label="Utility" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="Util DMG" value={String(d.utilityDamage ?? faceitPlayer.utilityDamage)} />
            <StatBlock label="Util ADR" value={utilityAdr} />
            <StatBlock label="Flash assists" value={String(d.flashAssists ?? 0)} />
            <StatBlock label="Flashed" value={String(d.enemiesFlashed ?? faceitPlayer.enemiesFlashed)} />
            <StatBlock label="Sniper kills" value={faceitPlayer.sniperKills.toString()} />
            <StatBlock label="Pistol kills" value={faceitPlayer.pistolKills.toString()} />
          </div>

          {/* Kill timing & multi-kills */}
          <SectionLabel label="Kill timing & highlights" />
          <div className="grid grid-cols-6 gap-2 mb-1">
            <StatBlock label="Early (0-25s)" value={String(d.killTimings?.early ?? 0)} />
            <StatBlock label="Mid (25-60s)" value={String(d.killTimings?.mid ?? 0)} />
            <StatBlock label="Late (60s+)" value={String(d.killTimings?.late ?? 0)} />
            <StatBlock label="3K" value={String(d.multiKills?.threeK ?? 0)} accent={(d.multiKills?.threeK ?? 0) > 0} />
            <StatBlock label="4K" value={String(d.multiKills?.fourK ?? 0)} accent={(d.multiKills?.fourK ?? 0) > 0} />
            <StatBlock label="ACE" value={String(d.multiKills?.ace ?? 0)} accent={(d.multiKills?.ace ?? 0) > 0} />
          </div>
        </>
      )}

      {/* Fallback: FACEIT-only stats */}
      {!d && (
        <>
          <SectionLabel label="Extended stats" />
          <div className="grid grid-cols-6 gap-2 mb-3">
            <StatBlock label="First kills" value={faceitPlayer.firstKills.toString()} />
            <StatBlock label="Entry" value={`${faceitPlayer.entryWins}/${faceitPlayer.entryCount}`} />
            <StatBlock label="Clutch kills" value={faceitPlayer.clutchKills.toString()} />
            <StatBlock label="Utility DMG" value={faceitPlayer.utilityDamage.toString()} />
            <StatBlock label="Sniper kills" value={faceitPlayer.sniperKills.toString()} />
            <StatBlock label="MVPs" value={faceitPlayer.mvps.toString()} />
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[9px] text-text-dim uppercase tracking-wider mb-1.5 mt-1">
      {label}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  let color = "text-text-dim bg-surface-elevated";
  if (rating >= 1.3) color = "text-green-400 bg-green-400/10";
  else if (rating >= 1.1) color = "text-accent bg-accent/10";
  else if (rating >= 0.9) color = "text-text bg-surface-elevated";
  else if (rating >= 0.7) color = "text-yellow-400 bg-yellow-400/10";
  else color = "text-error bg-error/10";

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {rating.toFixed(2)}
    </span>
  );
}

function StatBlock({
  label,
  value,
  accent,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
}) {
  let valueColor = "text-text";
  if (accent) valueColor = "text-accent";
  if (negative) valueColor = "text-error/70";

  return (
    <div>
      <div className="text-[9px] text-text-dim mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${valueColor}`}>{value}</div>
    </div>
  );
}
