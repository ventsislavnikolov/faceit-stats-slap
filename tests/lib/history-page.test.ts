import { describe, expect, it } from "vitest";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  getHistoryTabs,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
  normalizeHistoryTab,
} from "~/lib/history-page";

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

  it("normalizes the selected match count to supported presets", () => {
    expect(normalizeHistoryMatchCount(20)).toBe(20);
    expect(normalizeHistoryMatchCount("50")).toBe(50);
    expect(normalizeHistoryMatchCount("100")).toBe(100);
    expect(normalizeHistoryMatchCount("15")).toBe(20);
    expect(normalizeHistoryMatchCount(undefined)).toBe(20);
  });

  it("locks queue filters to all while solo and party are unsupported", () => {
    expect(normalizeHistoryQueueFilter("all")).toBe("all");
    expect(normalizeHistoryQueueFilter("solo")).toBe("solo");
    expect(normalizeHistoryQueueFilter("party")).toBe("party");
    expect(getHistoryQueueOptions()).toEqual([
      { value: "all", label: "All" },
      { value: "solo", label: "Solo" },
      { value: "party", label: "Party" },
    ]);
  });

  it("exposes the supported match count presets", () => {
    expect(getHistoryMatchCountOptions()).toEqual([20, 50, 100]);
  });
});
