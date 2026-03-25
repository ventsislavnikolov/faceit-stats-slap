import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, CartesianGrid, Legend, Cell,
} from "recharts";
import type { DemoMatchAnalytics, DemoPlayerAnalytics, DemoRoundAnalytics, MatchPlayerStats } from "~/lib/types";

// Design tokens matching app.css
const ACCENT = "#00ff88";
const ERROR = "#ff4444";
const BG_CARD = "#0a0a0a";
const BG_ELEVATED = "#111111";
const BORDER = "#1a1a1a";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#444444";
const TEXT_MUTED = "#888888";
const GOLD = "#ffd700";
const GREEN = "#4ade80";
const RED = "#f87171";
const BLUE = "#38bdf8";
const TEAM1_COLOR = ACCENT;
const TEAM2_COLOR = ERROR;

// ---------------------------------------------------------------------------
// Profile tag computation
// ---------------------------------------------------------------------------

function getProfileTag(p: DemoPlayerAnalytics): { tag: string; color: string } {
  const exitPct = (p.kills ?? 0) > 0 ? ((p.exitKills ?? 0) / p.kills!) * 100 : 0;
  if (exitPct > 20 && (p.lastAliveRounds ?? 0) >= 4) return { tag: "Exit Fragger", color: RED };
  if ((p.clutchWins ?? 0) >= 1 && (p.lastAliveRounds ?? 0) >= 3) return { tag: "Clutch Player", color: GOLD };
  if ((p.entryKills ?? 0) >= 3 && (p.lastAliveRounds ?? 0) <= 2) return { tag: "Entry Fragger", color: GREEN };
  if ((p.utilityDamage ?? 0) >= 150) return { tag: "Support", color: BLUE };
  return { tag: "Balanced", color: TEXT_MUTED };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KastCircle({ kast }: { kast: number }) {
  let color = RED;
  if (kast >= 75) color = GREEN;
  else if (kast >= 65) color = GOLD;
  else if (kast >= 55) color = "#fb923c";
  return (
    <div
      className="flex items-center justify-center rounded-full text-[10px] font-bold"
      style={{ width: 32, height: 32, border: `2px solid ${color}`, color }}
    >
      {Math.round(kast)}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  let color = TEXT_MUTED;
  if (rating >= 1.2) color = GOLD;
  else if (rating >= 1.0) color = GREEN;
  else if (rating >= 0.8) color = "#fb923c";
  else color = RED;
  return <span style={{ color, fontWeight: 700, fontSize: 16 }}>{rating.toFixed(2)}</span>;
}

function StatBar({ value, max, color, label, suffix = "" }: { value: number; max: number; color: string; label: string; suffix?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-text-muted">{label}</span>
        <span className="text-text">{typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BG_ELEVATED }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const tooltipStyle = { background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11 };

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

interface AnalystDashboardProps {
  matchData: {
    matchId: string;
    map: string;
    score: string;
    teams: {
      faction1: { name: string; score: number; playerIds: string[] };
      faction2: { name: string; score: number; playerIds: string[] };
    };
    players: MatchPlayerStats[];
    demoUrl: string | null;
    [key: string]: unknown;
  };
  demoAnalytics: DemoMatchAnalytics;
}

export function AnalystDashboard({ matchData, demoAnalytics }: AnalystDashboardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "scoreboard", label: "Scoreboard" },
    { id: "rounds", label: "Rounds" },
    { id: "compare", label: "Team Compare" },
  ];

  // Demo uses Steam IDs, FACEIT uses FACEIT UUIDs — match by nickname
  const demoByNickname = new Map(demoAnalytics.players.map((p) => [p.nickname.toLowerCase(), p]));
  const demoByPlayer = new Map(
    matchData.players.map((fp: MatchPlayerStats) => {
      const demo = demoByNickname.get(fp.nickname.toLowerCase());
      return [fp.playerId, demo] as const;
    }).filter(([, d]) => d != null),
  );
  const faceitByPlayer = new Map(matchData.players.map((p: MatchPlayerStats) => [p.playerId, p]));
  const selectedDemo = selectedPlayer ? demoByPlayer.get(selectedPlayer) ?? null : null;
  const selectedFaceit = selectedPlayer ? faceitByPlayer.get(selectedPlayer) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border border-border rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === t.id
                ? "bg-surface-elevated text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          demoAnalytics={demoAnalytics}
          matchData={matchData}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
          selectedDemo={selectedDemo}
          selectedFaceit={selectedFaceit}
        />
      )}
      {activeTab === "scoreboard" && (
        <ScoreboardTab
          demoAnalytics={demoAnalytics}
          matchData={matchData}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
          selectedDemo={selectedDemo}
          selectedFaceit={selectedFaceit}
        />
      )}
      {activeTab === "rounds" && <RoundsTab demoAnalytics={demoAnalytics} matchData={matchData} />}
      {activeTab === "compare" && <CompareTab demoAnalytics={demoAnalytics} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  demoAnalytics, matchData, selectedPlayer, onSelectPlayer, selectedDemo, selectedFaceit,
}: {
  demoAnalytics: DemoMatchAnalytics;
  matchData: AnalystDashboardProps["matchData"];
  selectedPlayer: string | null;
  onSelectPlayer: (id: string) => void;
  selectedDemo: DemoPlayerAnalytics | null;
  selectedFaceit: MatchPlayerStats | null;
}) {
  return (
    <div className="space-y-4">
      {/* Score evolution */}
      <Card title="Score Progression">
        <ScoreEvolution rounds={demoAnalytics.rounds} />
      </Card>

      {/* Scoreboard */}
      <Card title="Scoreboard — click a player for details">
        <ScoreboardTable
          demoAnalytics={demoAnalytics}
          matchData={matchData}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={onSelectPlayer}
        />
      </Card>

      {/* Player detail */}
      {selectedDemo && selectedFaceit && (
        <PlayerDetailCard demo={selectedDemo} faceit={selectedFaceit} totalRounds={demoAnalytics.totalRounds} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard Tab
// ---------------------------------------------------------------------------

function ScoreboardTab({
  demoAnalytics, matchData, selectedPlayer, onSelectPlayer, selectedDemo, selectedFaceit,
}: {
  demoAnalytics: DemoMatchAnalytics;
  matchData: AnalystDashboardProps["matchData"];
  selectedPlayer: string | null;
  onSelectPlayer: (id: string) => void;
  selectedDemo: DemoPlayerAnalytics | null;
  selectedFaceit: MatchPlayerStats | null;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <ScoreboardTable
          demoAnalytics={demoAnalytics}
          matchData={matchData}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={onSelectPlayer}
        />
      </Card>
      {selectedDemo && selectedFaceit && (
        <PlayerDetailCard demo={selectedDemo} faceit={selectedFaceit} totalRounds={demoAnalytics.totalRounds} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rounds Tab
// ---------------------------------------------------------------------------

function RoundsTab({ demoAnalytics, matchData }: { demoAnalytics: DemoMatchAnalytics; matchData: AnalystDashboardProps["matchData"] }) {
  const buyColor = (buy: string | undefined) => {
    if (buy === "full_buy") return GREEN;
    if (buy === "force_buy") return "#fb923c";
    if (buy === "eco") return RED;
    return TEXT_DIM;
  };

  return (
    <div className="space-y-4">
      <Card title="Score Progression">
        <ScoreEvolution rounds={demoAnalytics.rounds} />
      </Card>
      <div className="grid grid-cols-4 gap-2">
        {demoAnalytics.rounds.map((r) => {
          const isTeam1 = r.winnerTeamKey === "team1";
          const borderColor = isTeam1 ? TEAM1_COLOR : TEAM2_COLOR;
          return (
            <div
              key={r.roundNumber}
              className="border rounded-lg p-3"
              style={{ borderColor: BORDER, borderLeftColor: borderColor, borderLeftWidth: 3, background: BG_CARD }}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-text">R{r.roundNumber}</span>
                <span className="font-semibold text-xs" style={{ color: borderColor }}>
                  {r.scoreAfterRound.team1}:{r.scoreAfterRound.team2}
                </span>
              </div>
              <div className="text-[10px] text-text-muted">
                <div>T: <span style={{ color: buyColor(r.tBuyType) }}>{r.tBuyType ?? "?"}</span></div>
                <div>CT: <span style={{ color: buyColor(r.ctBuyType) }}>{r.ctBuyType ?? "?"}</span></div>
              </div>
              {r.endReason && (
                <div className="text-[9px] text-text-dim mt-1">{r.endReason.replace(/_/g, " ")}</div>
              )}
              {r.isPistolRound && <div className="text-[9px] font-semibold mt-1" style={{ color: GOLD }}>PISTOL</div>}
              {r.bombPlanted && (
                <div className="text-[9px] mt-0.5" style={{ color: r.bombDefused ? BLUE : "#fb923c" }}>
                  {r.bombDefused ? "Bomb defused" : "Bomb planted"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare Tab
// ---------------------------------------------------------------------------

function CompareTab({ demoAnalytics }: { demoAnalytics: DemoMatchAnalytics }) {
  const t1 = demoAnalytics.players.filter((p) => p.teamKey === "team1");
  const t2 = demoAnalytics.players.filter((p) => p.teamKey === "team2");

  const avg = (arr: DemoPlayerAnalytics[], fn: (p: DemoPlayerAnalytics) => number) =>
    arr.length > 0 ? arr.reduce((s, p) => s + fn(p), 0) / arr.length : 0;
  const sum = (arr: DemoPlayerAnalytics[], fn: (p: DemoPlayerAnalytics) => number) =>
    arr.reduce((s, p) => s + fn(p), 0);

  const metrics = [
    { label: "Avg Rating", a: avg(t1, (p) => p.rating ?? 0).toFixed(2), b: avg(t2, (p) => p.rating ?? 0).toFixed(2) },
    { label: "Total Kills", a: String(sum(t1, (p) => p.kills ?? 0)), b: String(sum(t2, (p) => p.kills ?? 0)) },
    { label: "Avg ADR", a: avg(t1, (p) => p.adr ?? 0).toFixed(1), b: avg(t2, (p) => p.adr ?? 0).toFixed(1) },
    { label: "Avg KAST%", a: `${avg(t1, (p) => p.kastPercent ?? 0).toFixed(0)}%`, b: `${avg(t2, (p) => p.kastPercent ?? 0).toFixed(0)}%` },
    { label: "Trade Kills", a: String(sum(t1, (p) => p.tradeKills)), b: String(sum(t2, (p) => p.tradeKills)) },
    { label: "Utility DMG", a: String(sum(t1, (p) => p.utilityDamage ?? 0)), b: String(sum(t2, (p) => p.utilityDamage ?? 0)) },
    { label: "Flash Assists", a: String(sum(t1, (p) => p.flashAssists ?? 0)), b: String(sum(t2, (p) => p.flashAssists ?? 0)) },
    { label: "Exit Kills", a: String(sum(t1, (p) => p.exitKills ?? 0)), b: String(sum(t2, (p) => p.exitKills ?? 0)), invert: true },
  ];

  // ADR by player chart data
  const adrData = [...demoAnalytics.players]
    .sort((a, b) => (b.adr ?? 0) - (a.adr ?? 0))
    .map((p) => ({ name: p.nickname, adr: p.adr ?? 0, team: p.teamKey }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between mb-4">
          <span className="font-bold text-sm" style={{ color: TEAM1_COLOR }}>
            {demoAnalytics.teams.find((t) => t.teamKey === "team1")?.name ?? "Team 1"}
          </span>
          <span className="text-text-dim text-xs self-center">VS</span>
          <span className="font-bold text-sm" style={{ color: TEAM2_COLOR }}>
            {demoAnalytics.teams.find((t) => t.teamKey === "team2")?.name ?? "Team 2"}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs">
          {metrics.map((m) => {
            const aNum = parseFloat(m.a);
            const bNum = parseFloat(m.b);
            const aWins = m.invert ? aNum < bNum : aNum > bNum;
            const bWins = m.invert ? bNum < aNum : bNum > aNum;
            return (
              <div key={m.label} className="contents">
                <div className="text-right py-1.5 px-3 font-semibold" style={{ color: aWins ? TEAM1_COLOR : TEXT_DIM }}>{m.a}</div>
                <div className="text-center py-1.5 px-4 text-[10px] border-x" style={{ borderColor: BORDER, color: TEXT_MUTED }}>{m.label}</div>
                <div className="text-left py-1.5 px-3 font-semibold" style={{ color: bWins ? TEAM2_COLOR : TEXT_DIM }}>{m.b}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="ADR by Player">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={adrData} barSize={28}>
            <XAxis dataKey="name" tick={{ fill: TEXT_MUTED, fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="adr" radius={[4, 4, 0, 0]}>
              {adrData.map((entry) => (
                <Cell key={entry.name} fill={entry.team === "team1" ? TEAM1_COLOR : TEAM2_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Evolution Chart
// ---------------------------------------------------------------------------

function ScoreEvolution({ rounds }: { rounds: DemoRoundAnalytics[] }) {
  const data = [
    { round: 0, team1: 0, team2: 0 },
    ...rounds.map((r) => ({
      round: r.roundNumber,
      team1: r.scoreAfterRound.team1,
      team2: r.scoreAfterRound.team2,
    })),
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis dataKey="round" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={{ stroke: BORDER }} />
        <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={{ stroke: BORDER }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: TEXT_MUTED }} />
        <Line type="monotone" dataKey="team1" stroke={TEAM1_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Team 1" />
        <Line type="monotone" dataKey="team2" stroke={TEAM2_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Team 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard Table
// ---------------------------------------------------------------------------

function ScoreboardTable({
  demoAnalytics, matchData, selectedPlayer, onSelectPlayer,
}: {
  demoAnalytics: DemoMatchAnalytics;
  matchData: AnalystDashboardProps["matchData"];
  selectedPlayer: string | null;
  onSelectPlayer: (id: string) => void;
}) {
  const faction1Set = new Set(matchData.teams.faction1.playerIds);
  const demoByNick = new Map(demoAnalytics.players.map((p) => [p.nickname.toLowerCase(), p]));

  const allPlayers = matchData.players.map((fp: MatchPlayerStats) => ({
    faceit: fp,
    demo: demoByNick.get(fp.nickname.toLowerCase()),
    teamKey: faction1Set.has(fp.playerId) ? "team1" as const : "team2" as const,
  }));

  const team1 = allPlayers.filter((p) => p.teamKey === "team1").sort((a, b) => (b.demo?.rating ?? 0) - (a.demo?.rating ?? 0));
  const team2 = allPlayers.filter((p) => p.teamKey === "team2").sort((a, b) => (b.demo?.rating ?? 0) - (a.demo?.rating ?? 0));

  const headers = ["Player", "RTG", "K", "D", "A", "K/D", "ADR", "HS%", "KAST"];

  const Row = ({ faceit, demo, teamKey }: { faceit: MatchPlayerStats; demo?: DemoPlayerAnalytics; teamKey: string }) => {
    const isSelected = selectedPlayer === faceit.playerId;
    const teamColor = teamKey === "team1" ? TEAM1_COLOR : TEAM2_COLOR;
    const kd = faceit.deaths > 0 ? faceit.kills / faceit.deaths : faceit.kills;

    return (
      <tr
        onClick={() => onSelectPlayer(faceit.playerId)}
        className="cursor-pointer transition-colors hover:bg-surface-elevated/50"
        style={{
          background: isSelected ? (teamKey === "team1" ? "rgba(0,255,136,0.06)" : "rgba(255,68,68,0.06)") : "transparent",
          borderLeft: isSelected ? `3px solid ${teamColor}` : "3px solid transparent",
        }}
      >
        <td className="py-2 px-3 font-semibold text-xs" style={{ color: teamColor }}>{faceit.nickname}</td>
        <td className="py-2 px-2 text-center">{demo?.rating != null ? <RatingBadge rating={demo.rating} /> : <span className="text-text-dim">-</span>}</td>
        <td className="py-2 px-2 text-center font-semibold" style={{ color: GREEN }}>{faceit.kills}</td>
        <td className="py-2 px-2 text-center font-semibold" style={{ color: RED }}>{faceit.deaths}</td>
        <td className="py-2 px-2 text-center text-text-muted">{faceit.assists}</td>
        <td className="py-2 px-2 text-center font-semibold" style={{ color: kd >= 1 ? GREEN : RED }}>{kd.toFixed(2)}</td>
        <td className="py-2 px-2 text-center" style={{ color: (demo?.adr ?? faceit.adr) >= 80 ? GREEN : (demo?.adr ?? faceit.adr) >= 60 ? GOLD : RED }}>
          {Math.round(demo?.adr ?? faceit.adr)}
        </td>
        <td className="py-2 px-2 text-center text-text">{demo?.hsPercent ?? faceit.hsPercent}%</td>
        <td className="py-2 px-2 text-center">
          {demo?.kastPercent != null ? <KastCircle kast={demo.kastPercent} /> : <span className="text-text-dim">-</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", color: TEXT }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
            {headers.map((h) => (
              <th key={h} className={`py-2 px-2 text-[10px] uppercase tracking-wider font-medium ${h === "Player" ? "text-left" : "text-center"}`} style={{ color: TEXT_MUTED }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {team2.map((p) => <Row key={p.faceit.playerId} {...p} />)}
          <tr><td colSpan={9} className="h-0.5" style={{ background: BORDER }} /></tr>
          {team1.map((p) => <Row key={p.faceit.playerId} {...p} />)}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player Detail Card with charts
// ---------------------------------------------------------------------------

function PlayerDetailCard({ demo, faceit, totalRounds }: { demo: DemoPlayerAnalytics; faceit: MatchPlayerStats; totalRounds: number }) {
  const teamColor = demo.teamKey === "team1" ? TEAM1_COLOR : TEAM2_COLOR;
  const profile = getProfileTag(demo);

  const radarData = [
    { stat: "Kills", value: Math.min((demo.kills ?? 0) / 25 * 100, 100) },
    { stat: "ADR", value: Math.min((demo.adr ?? 0) / 120 * 100, 100) },
    { stat: "KAST", value: demo.kastPercent ?? 0 },
    { stat: "HS%", value: demo.hsPercent ?? 0 },
    { stat: "Entry", value: Math.min((demo.entryKills ?? 0) / 6 * 100, 100) },
    { stat: "Trade", value: Math.min(demo.tradeKills / 6 * 100, 100) },
  ];

  const timingData = [
    { name: "Early", value: demo.killTimings?.early ?? 0, fill: GREEN },
    { name: "Mid", value: demo.killTimings?.mid ?? 0, fill: GOLD },
    { name: "Late", value: demo.killTimings?.late ?? 0, fill: RED },
  ];

  const impactKills = (demo.kills ?? 0) - (demo.exitKills ?? 0);
  const killBreakdown = [
    { name: "Impact", value: impactKills, fill: GREEN },
    { name: "Exit", value: demo.exitKills ?? 0, fill: RED },
  ];

  return (
    <Card>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold" style={{ color: teamColor }}>{faceit.nickname}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: profile.color + "22", color: profile.color }}>
            {profile.tag}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-text-muted">RATING</div>
          {demo.rating != null ? <RatingBadge rating={demo.rating} /> : <span className="text-text-dim">-</span>}
        </div>
      </div>

      {/* Radar + stat bars */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={BORDER} />
            <PolarAngleAxis dataKey="stat" tick={{ fill: TEXT_MUTED, fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={teamColor} fill={teamColor} fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>

        <div className="flex flex-col justify-center">
          <StatBar value={demo.adr ?? 0} max={120} color={teamColor} label="ADR" />
          <StatBar value={demo.kastPercent ?? 0} max={100} color={GREEN} label="KAST%" suffix="%" />
          <StatBar value={demo.hsPercent ?? 0} max={100} color={GOLD} label="HS%" suffix="%" />
          <StatBar value={demo.tradeKills} max={8} color={ACCENT} label="Trade Kills" />
          <StatBar value={demo.utilityDamage ?? 0} max={300} color="#a78bfa" label="Utility DMG" />
          <StatBar value={demo.flashAssists ?? 0} max={5} color={BLUE} label="Flash Assists" />
        </div>
      </div>

      {/* Kill timing + Impact vs Exit */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Kill Timing</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={timingData} barSize={30}>
              <XAxis dataKey="name" tick={{ fill: TEXT_MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {timingData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Impact vs Exit Kills</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={killBreakdown} layout="vertical" barSize={24}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {killBreakdown.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom stat boxes */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Entry Duels", value: `${demo.entryKills ?? 0}W / ${demo.entryDeaths ?? 0}L`, color: (demo.entryKills ?? 0) >= (demo.entryDeaths ?? 0) ? GREEN : RED },
          { label: "Last Alive", value: `${demo.lastAliveRounds ?? 0}x`, color: (demo.lastAliveRounds ?? 0) >= 4 ? "#fb923c" : TEXT },
          { label: "Clutch", value: `${demo.clutchWins ?? 0}/${demo.clutchAttempts ?? 0}`, color: (demo.clutchWins ?? 0) > 0 ? GOLD : TEXT_DIM },
          { label: "Untraded Deaths", value: String(demo.untradedDeaths), color: demo.untradedDeaths >= 8 ? RED : TEXT },
        ].map((s) => (
          <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: BG_ELEVATED }}>
            <div className="text-[9px] text-text-muted mb-0.5">{s.label}</div>
            <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4" style={{ background: BG_CARD }}>
      {title && (
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">{title}</div>
      )}
      {children}
    </div>
  );
}
