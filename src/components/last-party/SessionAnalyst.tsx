import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { AggregatePlayerStats } from "~/lib/types";

interface SessionAnalystProps {
  stats: Record<string, AggregatePlayerStats>;
}

const ACCENT_COLORS = [
  "#00ff88",
  "#ff4444",
  "#44aacc",
  "#cc9944",
  "#aa77cc",
  "#77aa55",
];

function normalize(value: number, max: number): number {
  return max > 0 ? Math.min((value / max) * 100, 100) : 0;
}

export function SessionAnalyst({ stats }: SessionAnalystProps) {
  const entries = Object.values(stats);
  if (entries.length === 0) {
    return null;
  }

  const maxKills = Math.max(...entries.map((e) => e.avgKd));
  const maxAdr = Math.max(...entries.map((e) => e.avgAdr));
  const maxKast = Math.max(...entries.map((e) => e.avgKast ?? 0));
  const maxHs = Math.max(...entries.map((e) => e.avgHsPercent));
  const maxEntry = Math.max(...entries.map((e) => e.avgEntryRate ?? 0));
  const maxTrade = Math.max(...entries.map((e) => e.avgTradeKills ?? 0));

  const radarData = [
    {
      axis: "K/D",
      ...Object.fromEntries(
        entries.map((e) => [e.nickname, normalize(e.avgKd, maxKills)])
      ),
    },
    {
      axis: "ADR",
      ...Object.fromEntries(
        entries.map((e) => [e.nickname, normalize(e.avgAdr, maxAdr)])
      ),
    },
    {
      axis: "KAST",
      ...Object.fromEntries(
        entries.map((e) => [e.nickname, normalize(e.avgKast ?? 0, maxKast)])
      ),
    },
    {
      axis: "HS%",
      ...Object.fromEntries(
        entries.map((e) => [e.nickname, normalize(e.avgHsPercent, maxHs)])
      ),
    },
    {
      axis: "Entry",
      ...Object.fromEntries(
        entries.map((e) => [
          e.nickname,
          normalize(e.avgEntryRate ?? 0, maxEntry),
        ])
      ),
    },
    {
      axis: "Trades",
      ...Object.fromEntries(
        entries.map((e) => [
          e.nickname,
          normalize(e.avgTradeKills ?? 0, maxTrade),
        ])
      ),
    },
  ];

  const totalTradeKills = entries.reduce(
    (s, e) => s + (e.avgTradeKills ?? 0) * e.gamesPlayed,
    0
  );
  const totalUtilDmg = entries.reduce(
    (s, e) => s + (e.avgUtilityDamage ?? 0) * e.gamesPlayed,
    0
  );
  const avgKast =
    entries.reduce((s, e) => s + (e.avgKast ?? 0), 0) / entries.length;
  const avgRating =
    entries.reduce((s, e) => s + (e.avgRating ?? 0), 0) / entries.length;
  const avgEconEfficiency =
    entries.reduce((s, e) => s + (e.avgEconomyEfficiency ?? 0), 0) /
    entries.length;

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Analyst
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded border border-border bg-bg-card p-4">
          <ResponsiveContainer height={300} width="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1a1a1a" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "#888888", fontSize: 10 }}
              />
              {entries.map((e, i) => (
                <Radar
                  dataKey={e.nickname}
                  fill={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  fillOpacity={0.1}
                  key={e.faceitId}
                  name={e.nickname}
                  stroke={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  strokeWidth={2}
                />
              ))}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #1a1a1a",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded border border-border bg-bg-card p-4">
          <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
            Session Totals
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-dim">Avg Rating</div>
              <div className="font-bold text-accent text-lg">
                {avgRating.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Avg KAST%</div>
              <div className="font-bold text-lg text-text">
                {avgKast.toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-text-dim">Total Trade Kills</div>
              <div className="font-bold text-lg text-text">
                {Math.round(totalTradeKills)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Total Utility DMG</div>
              <div className="font-bold text-lg text-text">
                {Math.round(totalUtilDmg)}
              </div>
            </div>
            <div>
              <div className="text-text-dim">Avg Spend Efficiency</div>
              <div className="font-bold text-lg text-text">
                {avgEconEfficiency.toFixed(1)} DMG/$1K
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
