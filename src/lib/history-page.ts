export type HistoryMatchCount = 20 | 50 | 100;
export type HistoryQueueFilter = "all" | "solo" | "party";

const HISTORY_MATCH_COUNT_OPTIONS: Array<{
  value: HistoryMatchCount;
  label: string;
}> = [
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
];

export function getHistoryMatchCountOptions(): Array<{
  value: HistoryMatchCount;
  label: string;
}> {
  return HISTORY_MATCH_COUNT_OPTIONS;
}

export function normalizeHistoryMatchCount(value: unknown): HistoryMatchCount {
  const numericValue = typeof value === "number" ? value : Number(value);

  return HISTORY_MATCH_COUNT_OPTIONS.some(
    (option) => option.value === numericValue
  )
    ? (numericValue as HistoryMatchCount)
    : 20;
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

export function normalizeHistoryQueueFilter(
  value: unknown
): HistoryQueueFilter {
  return value === "solo" || value === "party" || value === "all"
    ? value
    : "party";
}
