export type HistoryTab = "matches" | "bets";

export function getHistoryTabs(isSignedIn: boolean): HistoryTab[] {
  return isSignedIn ? ["matches", "bets"] : ["matches"];
}

export function normalizeHistoryTab(tab: HistoryTab, isSignedIn: boolean): HistoryTab {
  if (!isSignedIn && tab === "bets") {
    return "matches";
  }

  return tab;
}
