import { describe, expect, it } from "vitest";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  getHistoryTabs,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
  normalizeHistoryTab,
  shouldEnableHistoryLookups,
} from "~/lib/history-page";

describe("history page access", () => {
  it("shows the bets tab only for signed-in users", () => {
    expect(getHistoryTabs(true)).toEqual(["matches", "bets"]);
    expect(getHistoryTabs(false)).toEqual(["matches"]);
  });

  it("falls back to the matches tab when bets is unavailable", () => {
    expect(normalizeHistoryTab("bets", false)).toBe("matches");
    expect(normalizeHistoryTab("matches", false)).toBe("matches");
    expect(normalizeHistoryTab("matches", true)).toBe("matches");
    expect(normalizeHistoryTab("bets", true)).toBe("bets");
  });

  it("normalizes the selected match count to supported presets", () => {
    expect(normalizeHistoryMatchCount("yesterday")).toBe("yesterday");
    expect(normalizeHistoryMatchCount(20)).toBe(20);
    expect(normalizeHistoryMatchCount("50")).toBe(50);
    expect(normalizeHistoryMatchCount("100")).toBe(100);
    expect(normalizeHistoryMatchCount("15")).toBe("yesterday");
    expect(normalizeHistoryMatchCount(undefined)).toBe("yesterday");
  });

  it("defaults queue filters to party and lists party first", () => {
    expect(normalizeHistoryQueueFilter("all")).toBe("all");
    expect(normalizeHistoryQueueFilter("solo")).toBe("solo");
    expect(normalizeHistoryQueueFilter("party")).toBe("party");
    expect(normalizeHistoryQueueFilter(undefined)).toBe("party");
    expect(getHistoryQueueOptions()).toEqual([
      { value: "party", label: "Party" },
      { value: "solo", label: "Solo" },
      { value: "all", label: "All" },
    ]);
  });

  it("exposes the supported match count presets", () => {
    expect(getHistoryMatchCountOptions()).toEqual([
      { value: "yesterday", label: "Yesterday" },
      { value: 20, label: "20" },
      { value: 50, label: "50" },
      { value: 100, label: "100" },
    ]);
  });

  it("disables history lookups until auth resolves and matches is active", () => {
    expect(shouldEnableHistoryLookups("bets", true)).toBe(false);
    expect(shouldEnableHistoryLookups("matches", false)).toBe(false);
    expect(shouldEnableHistoryLookups("matches", true)).toBe(true);
  });
});
