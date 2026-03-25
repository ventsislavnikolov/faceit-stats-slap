import type { DemoRoundAnalytics } from "~/lib/types";

interface RoundTimelineProps {
  rounds: DemoRoundAnalytics[];
  team1Name: string;
  team2Name: string;
}

const HALF_BOUNDARY = 12;

const BUY_LABELS: Record<string, { short: string; color: string }> = {
  full_buy: { short: "F", color: "text-green-400" },
  force_buy: { short: "B", color: "text-yellow-400" },
  eco: { short: "$", color: "text-red-400" },
  unknown: { short: "?", color: "text-text-dim" },
};

const END_REASON_ICONS: Record<string, string> = {
  ct_killed: "x",
  t_killed: "x",
  bomb_exploded: "!",
  bomb_defused: "d",
  time_ran_out: "t",
};

export function RoundTimeline({ rounds, team1Name, team2Name }: RoundTimelineProps) {
  if (rounds.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 text-center text-xs text-text-dim">
        No rounds data available
      </div>
    );
  }

  const lastRound = rounds[rounds.length - 1];
  const finalScore = lastRound.scoreAfterRound;

  // Half-time score
  const halfTimeRound = rounds.find((r) => r.roundNumber === HALF_BOUNDARY);
  const halfTimeScore = halfTimeRound?.scoreAfterRound;

  const firstHalf = rounds.filter((r) => r.roundNumber <= HALF_BOUNDARY);
  const secondHalf = rounds.filter((r) => r.roundNumber > HALF_BOUNDARY);

  // Momentum shifts (streak of 3+ broken)
  let momentumShifts = 0;
  let currentStreak = 0;
  let currentWinner: string | null = null;
  for (const r of rounds) {
    if (r.winnerTeamKey === currentWinner) {
      currentStreak++;
    } else {
      if (currentStreak >= 3) momentumShifts++;
      currentWinner = r.winnerTeamKey;
      currentStreak = 1;
    }
  }

  return (
    <div className="border border-border rounded-lg p-4">
      {/* Score header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text">{team1Name}</span>
          <span className="text-lg font-bold text-accent">{finalScore.team1}</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-text-dim uppercase tracking-wider">Round timeline</span>
          {halfTimeScore && (
            <div className="text-[9px] text-text-dim">
              HT: {halfTimeScore.team1}-{halfTimeScore.team2}
              {momentumShifts > 0 && ` · ${momentumShifts} momentum shift${momentumShifts > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-error">{finalScore.team2}</span>
          <span className="text-xs font-medium text-text">{team2Name}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-start gap-0.5">
        <HalfSection rounds={firstHalf} label="1st half" />
        <div className="w-px h-16 bg-border mx-1 flex-shrink-0 mt-4" />
        <HalfSection rounds={secondHalf} label="2nd half" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-text-dim flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-accent inline-block" />
          {team1Name}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-error inline-block" />
          {team2Name}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm border border-text-dim inline-block" />
          pistol
        </span>
        <span>
          <span className="text-green-400">F</span>=full{" "}
          <span className="text-yellow-400">B</span>=force{" "}
          <span className="text-red-400">$</span>=eco
        </span>
        <span>
          <span className="text-orange-400">B</span>=bomb{" "}
          <span className="text-blue-400">D</span>=defuse
        </span>
      </div>
    </div>
  );
}

function HalfSection({
  rounds,
  label,
}: {
  rounds: DemoRoundAnalytics[];
  label: string;
}) {
  return (
    <div className="flex-1">
      <div className="text-[8px] text-text-dim text-center mb-1 uppercase">{label}</div>
      <div className="flex gap-0.5 justify-center">
        {rounds.map((round) => (
          <RoundMarker key={round.roundNumber} round={round} />
        ))}
      </div>
    </div>
  );
}

function RoundMarker({ round }: { round: DemoRoundAnalytics }) {
  const isTeam1Win = round.winnerTeamKey === "team1";
  const bgColor = isTeam1Win ? "bg-accent" : "bg-error";
  const isPistol = round.isPistolRound;

  const tBuy = BUY_LABELS[round.tBuyType ?? "unknown"] ?? BUY_LABELS.unknown;
  const ctBuy = BUY_LABELS[round.ctBuyType ?? "unknown"] ?? BUY_LABELS.unknown;
  const endIcon = END_REASON_ICONS[round.endReason ?? ""] ?? "";

  return (
    <div className="flex flex-col items-center w-5">
      {/* Buy type indicator: T side on top */}
      <div className="flex gap-px text-[6px] leading-none mb-0.5">
        <span className={tBuy.color}>{tBuy.short}</span>
        <span className={ctBuy.color}>{ctBuy.short}</span>
      </div>

      {/* Round number box */}
      <div
        className={`w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-medium text-white ${bgColor} ${
          isPistol ? "ring-1 ring-white/40" : ""
        }`}
        title={`R${round.roundNumber}${isPistol ? " (pistol)" : ""} — ${round.scoreAfterRound.team1}:${round.scoreAfterRound.team2} — ${round.endReason ?? ""}`}
      >
        {round.roundNumber}
      </div>

      {/* Bottom indicators: bomb/defuse + pistol */}
      <div className="flex items-center gap-px mt-0.5 h-3">
        {round.bombPlanted && (
          <span className={`text-[7px] font-bold ${round.bombDefused ? "text-blue-400" : "text-orange-400"}`}>
            {round.bombDefused ? "D" : "B"}
          </span>
        )}
        {isPistol && <span className="text-[6px] text-text-dim">P</span>}
      </div>
    </div>
  );
}
