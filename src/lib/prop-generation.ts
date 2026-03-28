interface PlayerAverages {
  avgAdr: number;
  avgKd: number;
  avgKills: number;
}

interface PropThresholds {
  adr: number;
  kd: number;
  kills: number;
}

export function generatePropThresholds(
  averages: PlayerAverages
): PropThresholds {
  return {
    kills: ceilAbove(averages.avgKills),
    kd: roundUpOneDecimal(averages.avgKd),
    adr: ceilAbove(averages.avgAdr),
  };
}

function ceilAbove(value: number): number {
  const ceiled = Math.ceil(value);
  return ceiled === value ? ceiled + 1 : ceiled;
}

function roundUpOneDecimal(value: number): number {
  const rounded = Math.ceil(value * 10) / 10;
  return rounded === value ? Math.round((rounded + 0.1) * 10) / 10 : rounded;
}

export function buildPropDescription(
  nickname: string,
  statKey: "kills" | "kd" | "adr",
  threshold: number
): string {
  const label =
    statKey === "kills" ? "kills" : statKey === "kd" ? "K/D" : "ADR";
  const thresholdStr =
    statKey === "kd" ? threshold.toFixed(1) : String(threshold);
  return `${nickname} ${thresholdStr}+ ${label}`;
}
