export type HistoryTab = "matches" | "bets";
export type HistoryMatchCount = "yesterday" | 20 | 50 | 100;
export type HistoryQueueFilter = "all" | "solo" | "party";

const HISTORY_MATCH_COUNT_OPTIONS: Array<{
  value: HistoryMatchCount;
  label: string;
}> = [
  { value: "yesterday", label: "Yesterday" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
];

export function getHistoryTabs(isSignedIn: boolean): HistoryTab[] {
  return isSignedIn ? ["matches", "bets"] : ["matches"];
}

export function normalizeHistoryTab(tab: HistoryTab, isSignedIn: boolean): HistoryTab {
  if (!isSignedIn && tab === "bets") {
    return "matches";
  }

  return tab;
}

export function shouldEnableHistoryLookups(
  tab: HistoryTab,
  authResolved: boolean,
): boolean {
  return authResolved && tab === "matches";
}

export function getHistoryMatchCountOptions(): Array<{
  value: HistoryMatchCount;
  label: string;
}> {
  return HISTORY_MATCH_COUNT_OPTIONS;
}

export function normalizeHistoryMatchCount(value: unknown): HistoryMatchCount {
  if (value === "yesterday") {
    return "yesterday";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  return HISTORY_MATCH_COUNT_OPTIONS.some((option) => option.value === numericValue)
    ? (numericValue as Exclude<HistoryMatchCount, "yesterday">)
    : "yesterday";
}

export function getHistoryQueueOptions(): Array<{
  value: HistoryQueueFilter;
  label: string;
}> {
  return [
    { value: "party", label: "Party" },
    { value: "solo", label: "Solo" },
    { value: "all", label: "All" },
  ];
}

export function normalizeHistoryQueueFilter(value: unknown): HistoryQueueFilter {
  return value === "solo" || value === "party" || value === "all"
    ? value
    : "party";
}
