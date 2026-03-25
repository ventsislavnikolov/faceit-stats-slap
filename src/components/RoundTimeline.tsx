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

export function RoundTimeline({
  rounds,
  team1Name,
  team2Name,
}: RoundTimelineProps) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-center text-text-dim text-xs">
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
      if (currentStreak >= 3) {
        momentumShifts++;
      }
      currentWinner = r.winnerTeamKey;
      currentStreak = 1;
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      {/* Score header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text text-xs">{team1Name}</span>
          <span className="font-bold text-accent text-lg">
            {finalScore.team1}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-text-dim uppercase tracking-wider">
            Round timeline
          </span>
          {halfTimeScore && (
            <div className="text-[9px] text-text-dim">
              HT: {halfTimeScore.team1}-{halfTimeScore.team2}
              {momentumShifts > 0 &&
                ` · ${momentumShifts} momentum shift${momentumShifts > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-error text-lg">
            {finalScore.team2}
          </span>
          <span className="font-medium text-text text-xs">{team2Name}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-start gap-0.5">
        <HalfSection label="1st half" rounds={firstHalf} />
        <div className="mx-1 mt-4 h-16 w-px flex-shrink-0 bg-border" />
        <HalfSection label="2nd half" rounds={secondHalf} />
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px] text-text-dim">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-accent" />
          {team1Name}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-error" />
          {team2Name}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm border border-text-dim" />
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
      <div className="mb-1 text-center text-[8px] text-text-dim uppercase">
        {label}
      </div>
      <div className="flex justify-center gap-0.5">
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
    <div className="flex w-5 flex-col items-center">
      {/* Buy type indicator: T side on top */}
      <div className="mb-0.5 flex gap-px text-[6px] leading-none">
        <span className={tBuy.color}>{tBuy.short}</span>
        <span className={ctBuy.color}>{ctBuy.short}</span>
      </div>

      {/* Round number box */}
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-sm font-medium text-[8px] text-white ${bgColor} ${
          isPistol ? "ring-1 ring-white/40" : ""
        }`}
        title={`R${round.roundNumber}${isPistol ? " (pistol)" : ""} — ${round.scoreAfterRound.team1}:${round.scoreAfterRound.team2} — ${round.endReason ?? ""}`}
      >
        {round.roundNumber}
      </div>

      {/* Bottom indicators: bomb/defuse + pistol */}
      <div className="mt-0.5 flex h-3 items-center gap-px">
        {round.bombPlanted && (
          <span
            className={`font-bold text-[7px] ${round.bombDefused ? "text-blue-400" : "text-orange-400"}`}
          >
            {round.bombDefused ? "D" : "B"}
          </span>
        )}
        {isPistol && <span className="text-[6px] text-text-dim">P</span>}
      </div>
    </div>
  );
}
