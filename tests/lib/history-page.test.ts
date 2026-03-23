import { describe, expect, it } from "vitest";
import { getHistoryTabs, normalizeHistoryTab } from "~/lib/history-page";

describe("history page access", () => {
  it("shows the bets tab only for signed-in users", () => {
    expect(getHistoryTabs(true)).toEqual(["matches", "bets"]);
    expect(getHistoryTabs(false)).toEqual(["matches"]);
  });

  it("falls back to the matches tab when bets is unavailable", () => {
    expect(normalizeHistoryTab("bets", false)).toBe("matches");
    expect(normalizeHistoryTab("matches", false)).toBe("matches");
    expect(normalizeHistoryTab("bets", true)).toBe("bets");
  });
});
