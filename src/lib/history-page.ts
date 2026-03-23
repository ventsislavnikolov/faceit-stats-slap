export type HistoryTab = "matches" | "bets";
export type HistoryMatchCount = 20 | 50 | 100;
export type HistoryQueueFilter = "all" | "solo" | "party";

const HISTORY_MATCH_COUNT_OPTIONS: HistoryMatchCount[] = [20, 50, 100];

export function getHistoryTabs(isSignedIn: boolean): HistoryTab[] {
  return isSignedIn ? ["matches", "bets"] : ["matches"];
}

export function normalizeHistoryTab(tab: HistoryTab, isSignedIn: boolean): HistoryTab {
  if (!isSignedIn && tab === "bets") {
    return "matches";
  }

  return tab;
}

export function getHistoryMatchCountOptions(): HistoryMatchCount[] {
  return HISTORY_MATCH_COUNT_OPTIONS;
}

export function normalizeHistoryMatchCount(value: unknown): HistoryMatchCount {
  const numericValue = typeof value === "number" ? value : Number(value);

  return HISTORY_MATCH_COUNT_OPTIONS.includes(numericValue as HistoryMatchCount)
    ? (numericValue as HistoryMatchCount)
    : 20;
}

export function getHistoryQueueOptions(): Array<{
  value: HistoryQueueFilter;
  label: string;
}> {
  return [
    { value: "all", label: "All" },
    { value: "solo", label: "Solo" },
    { value: "party", label: "Party" },
  ];
}

export function normalizeHistoryQueueFilter(value: unknown): HistoryQueueFilter {
  return value === "solo" || value === "party" || value === "all" ? value : "all";
}
