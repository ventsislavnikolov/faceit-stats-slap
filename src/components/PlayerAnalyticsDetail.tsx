import type { DemoPlayerAnalytics, MatchPlayerStats } from "~/lib/types";

interface PlayerAnalyticsDetailProps {
  demoPlayer: DemoPlayerAnalytics | null;
  faceitPlayer: MatchPlayerStats | null;
  totalRounds?: number;
}

export function PlayerAnalyticsDetail({
  faceitPlayer,
  demoPlayer,
  totalRounds = 0,
}: PlayerAnalyticsDetailProps) {
  if (!faceitPlayer) {
    return (
      <div className="rounded-lg border border-border p-4 text-center text-text-dim text-xs">
        Select a player to view detailed analytics
      </div>
    );
  }

  const d = demoPlayer;
  const kills = d?.kills ?? faceitPlayer.kills;
  const deaths = d?.deaths ?? faceitPlayer.deaths;
  const impactKills = kills - (d?.exitKills ?? 0);
  const exitPercent =
    kills > 0 ? Math.round(((d?.exitKills ?? 0) / kills) * 100) : 0;
  const tradeKillPercent =
    kills > 0 ? Math.round(((d?.tradeKills ?? 0) / kills) * 100) : 0;
  const tradedDeathPercent =
    deaths > 0 ? Math.round(((d?.tradedDeaths ?? 0) / deaths) * 100) : 0;
  const damagePerKill =
    kills > 0 ? Math.round((d?.damage ?? faceitPlayer.damage) / kills) : 0;
  const utilityAdr =
    totalRounds > 0 ? ((d?.utilityDamage ?? 0) / totalRounds).toFixed(1) : "0";

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-text">
            {faceitPlayer.nickname}
          </span>
          {d?.rating != null && <RatingBadge rating={d.rating} />}
        </div>
        <span className="text-[10px] text-text-dim">Player detail</span>
      </div>

      {/* Core stats */}
      <SectionLabel label="Core stats" />
      <div className="mb-3 grid grid-cols-6 gap-2">
        <StatBlock
          label="K/D/A"
          value={`${kills}/${deaths}/${d?.assists ?? faceitPlayer.assists}`}
        />
        <StatBlock
          accent={faceitPlayer.kdRatio >= 1}
          label="K/D"
          value={faceitPlayer.kdRatio.toFixed(2)}
        />
        <StatBlock
          label="ADR"
          value={Math.round(d?.adr ?? faceitPlayer.adr).toString()}
        />
        <StatBlock
          label="HS%"
          value={`${d?.hsPercent ?? faceitPlayer.hsPercent}%`}
        />
        <StatBlock
          accent={(d?.kastPercent ?? 0) >= 70}
          label="KAST%"
          value={d?.kastPercent == null ? "-" : `${d.kastPercent}%`}
        />
        <StatBlock label="DMG/Kill" value={String(damagePerKill)} />
      </div>

      {d && (
        <>
          {/* Kill breakdown */}
          <SectionLabel label="Kill breakdown" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              accent
              label="Impact kills"
              value={String(impactKills)}
            />
            <StatBlock
              label="Exit kills"
              negative={(d.exitKills ?? 0) > 0}
              value={String(d.exitKills ?? 0)}
            />
            <StatBlock
              label="Exit %"
              negative={exitPercent > 15}
              value={`${exitPercent}%`}
            />
            <StatBlock
              accent
              label="Trade kills"
              value={String(d.tradeKills)}
            />
            <StatBlock label="TK %" value={`${tradeKillPercent}%`} />
            <StatBlock label="HS" value={String(d.headshots ?? 0)} />
          </div>

          {/* Death breakdown */}
          <SectionLabel label="Death breakdown" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock label="Deaths" value={String(deaths)} />
            <StatBlock accent label="Traded" value={String(d.tradedDeaths)} />
            <StatBlock
              accent={tradedDeathPercent >= 50}
              label="Traded %"
              value={`${tradedDeathPercent}%`}
            />
            <StatBlock
              label="Untraded"
              negative
              value={String(d.untradedDeaths)}
            />
            <StatBlock
              label="Entry deaths"
              value={String(d.entryDeaths ?? 0)}
            />
            <StatBlock
              label="Last alive"
              value={String(d.lastAliveRounds ?? 0)}
            />
          </div>

          {/* Opening duels */}
          <SectionLabel label="Opening duels" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock label="Entry kills" value={String(d.entryKills ?? 0)} />
            <StatBlock
              label="Entry deaths"
              value={String(d.entryDeaths ?? 0)}
            />
            <StatBlock
              accent={(d.openingDuelWins ?? 0) > (d.entryDeaths ?? 0)}
              label="OD win%"
              value={
                (d.openingDuelAttempts ?? 0) > 0
                  ? `${Math.round(((d.openingDuelWins ?? 0) / d.openingDuelAttempts!) * 100)}%`
                  : "-"
              }
            />
            <StatBlock
              label="OD attempts"
              value={String(d.openingDuelAttempts ?? 0)}
            />
            <StatBlock
              label="First kills"
              value={faceitPlayer.firstKills.toString()}
            />
            <StatBlock label="" value="" />
          </div>

          {/* Clutch & survival */}
          <SectionLabel label="Clutch & survival" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              accent={(d.clutchWins ?? 0) > 0}
              label="Clutch W/A"
              value={`${d.clutchWins ?? 0}/${d.clutchAttempts ?? 0}`}
            />
            <StatBlock
              label="Clutch %"
              value={
                (d.clutchAttempts ?? 0) > 0
                  ? `${Math.round(((d.clutchWins ?? 0) / d.clutchAttempts!) * 100)}%`
                  : "-"
              }
            />
            <StatBlock accent label="RWS" value={d.rws.toFixed(1)} />
            <StatBlock label="Plants" value={String(d.bombPlants ?? 0)} />
            <StatBlock label="Defuses" value={String(d.bombDefuses ?? 0)} />
            <StatBlock label="MVPs" value={faceitPlayer.mvps.toString()} />
          </div>

          {/* Utility */}
          <SectionLabel label="Utility" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              label="Util DMG"
              value={String(d.utilityDamage ?? faceitPlayer.utilityDamage)}
            />
            <StatBlock label="Util ADR" value={utilityAdr} />
            <StatBlock
              label="Flash assists"
              value={String(d.flashAssists ?? 0)}
            />
            <StatBlock
              label="Flashed"
              value={String(d.enemiesFlashed ?? faceitPlayer.enemiesFlashed)}
            />
            <StatBlock
              label="Sniper kills"
              value={faceitPlayer.sniperKills.toString()}
            />
            <StatBlock
              label="Pistol kills"
              value={faceitPlayer.pistolKills.toString()}
            />
          </div>

          {/* Kill timing & multi-kills */}
          <SectionLabel label="Kill timing & highlights" />
          <div className="mb-1 grid grid-cols-6 gap-2">
            <StatBlock
              label="Early (0-25s)"
              value={String(d.killTimings?.early ?? 0)}
            />
            <StatBlock
              label="Mid (25-60s)"
              value={String(d.killTimings?.mid ?? 0)}
            />
            <StatBlock
              label="Late (60s+)"
              value={String(d.killTimings?.late ?? 0)}
            />
            <StatBlock
              accent={(d.multiKills?.threeK ?? 0) > 0}
              label="3K"
              value={String(d.multiKills?.threeK ?? 0)}
            />
            <StatBlock
              accent={(d.multiKills?.fourK ?? 0) > 0}
              label="4K"
              value={String(d.multiKills?.fourK ?? 0)}
            />
            <StatBlock
              accent={(d.multiKills?.ace ?? 0) > 0}
              label="ACE"
              value={String(d.multiKills?.ace ?? 0)}
            />
          </div>

          {/* Utility thrown */}
          <SectionLabel label="Utility thrown" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock label="Smokes" value={String(d.smokesThrown ?? 0)} />
            <StatBlock label="Flashes" value={String(d.flashesThrown ?? 0)} />
            <StatBlock label="HEs" value={String(d.hesThrown ?? 0)} />
            <StatBlock label="Molotovs" value={String(d.molotovsThrown ?? 0)} />
            <StatBlock
              label="Util/round"
              value={String(d.utilityPerRound ?? 0)}
            />
            <StatBlock
              label="Avg blind"
              value={`${(d.avgFlashBlindDuration ?? 0).toFixed(1)}s`}
            />
          </div>
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              label="Team flashes"
              negative={(d.teamFlashes ?? 0) > 5}
              value={String(d.teamFlashes ?? 0)}
            />
            <StatBlock
              accent={(d.effectiveFlashRate ?? 0) >= 50}
              label="Eff. flash%"
              value={`${d.effectiveFlashRate ?? 0}%`}
            />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
            <StatBlock label="" value="" />
          </div>

          {/* Kill quality */}
          <SectionLabel label="Kill quality" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              accent={(d.wallbangKills ?? 0) > 0}
              label="Wallbangs"
              value={String(d.wallbangKills ?? 0)}
            />
            <StatBlock
              accent={(d.thrusmokeKills ?? 0) > 0}
              label="Thru smoke"
              value={String(d.thrusmokeKills ?? 0)}
            />
            <StatBlock
              accent={(d.noscopeKills ?? 0) > 0}
              label="No-scopes"
              value={String(d.noscopeKills ?? 0)}
            />
            <StatBlock
              label="Avg dist"
              value={(d.avgKillDistance ?? 0).toFixed(1)}
            />
            {(() => {
              const wk = d.weaponKills ?? {};
              const top = Object.entries(wk)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 2);
              return top.map(([w, c]) => (
                <StatBlock
                  key={w}
                  label={w.replace(/_/g, " ")}
                  value={String(c)}
                />
              ));
            })()}
          </div>

          {/* Side performance */}
          <SectionLabel label="Side performance" />
          <div className="mb-3 grid grid-cols-2 gap-4">
            <div className="rounded border border-border p-2">
              <div className="mb-1 text-[9px] text-text-dim uppercase">
                CT side
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <div className="text-text-dim">K</div>
                  <div className="font-medium text-text">{d.ctKills ?? 0}</div>
                </div>
                <div>
                  <div className="text-text-dim">D</div>
                  <div className="font-medium text-text">{d.ctDeaths ?? 0}</div>
                </div>
                <div>
                  <div className="text-text-dim">ADR</div>
                  <div className="font-medium text-text">
                    {(d.ctAdr ?? 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-text-dim">RTG</div>
                  <div className="font-medium text-accent">
                    {(d.ctRating ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded border border-border p-2">
              <div className="mb-1 text-[9px] text-text-dim uppercase">
                T side
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <div className="text-text-dim">K</div>
                  <div className="font-medium text-text">{d.tKills ?? 0}</div>
                </div>
                <div>
                  <div className="text-text-dim">D</div>
                  <div className="font-medium text-text">{d.tDeaths ?? 0}</div>
                </div>
                <div>
                  <div className="text-text-dim">ADR</div>
                  <div className="font-medium text-text">
                    {(d.tAdr ?? 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-text-dim">RTG</div>
                  <div className="font-medium text-accent">
                    {(d.tRating ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fallback: FACEIT-only stats */}
      {!d && (
        <>
          <SectionLabel label="Extended stats" />
          <div className="mb-3 grid grid-cols-6 gap-2">
            <StatBlock
              label="First kills"
              value={faceitPlayer.firstKills.toString()}
            />
            <StatBlock
              label="Entry"
              value={`${faceitPlayer.entryWins}/${faceitPlayer.entryCount}`}
            />
            <StatBlock
              label="Clutch kills"
              value={faceitPlayer.clutchKills.toString()}
            />
            <StatBlock
              label="Utility DMG"
              value={faceitPlayer.utilityDamage.toString()}
            />
            <StatBlock
              label="Sniper kills"
              value={faceitPlayer.sniperKills.toString()}
            />
            <StatBlock label="MVPs" value={faceitPlayer.mvps.toString()} />
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-1 mb-1.5 text-[9px] text-text-dim uppercase tracking-wider">
      {label}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  let color = "text-text-dim bg-surface-elevated";
  if (rating >= 1.3) {
    color = "text-green-400 bg-green-400/10";
  } else if (rating >= 1.1) {
    color = "text-accent bg-accent/10";
  } else if (rating >= 0.9) {
    color = "text-text bg-surface-elevated";
  } else if (rating >= 0.7) {
    color = "text-yellow-400 bg-yellow-400/10";
  } else {
    color = "text-error bg-error/10";
  }

  return (
    <span className={`rounded px-1.5 py-0.5 font-bold text-[10px] ${color}`}>
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
  if (accent) {
    valueColor = "text-accent";
  }
  if (negative) {
    valueColor = "text-error/70";
  }

  return (
    <div>
      <div className="mb-0.5 text-[9px] text-text-dim">{label}</div>
      <div className={`font-medium text-sm ${valueColor}`}>{value}</div>
    </div>
  );
}
