import { describe, expect, it } from "vitest";
import {
  getHistoryMatchCountOptions,
  getHistoryQueueOptions,
  normalizeHistoryMatchCount,
  normalizeHistoryQueueFilter,
} from "~/lib/history-page";

describe("history page helpers", () => {
  it("normalizes the selected match count to supported presets", () => {
    expect(normalizeHistoryMatchCount(20)).toBe(20);
    expect(normalizeHistoryMatchCount("50")).toBe(50);
    expect(normalizeHistoryMatchCount("100")).toBe(100);
    expect(normalizeHistoryMatchCount("15")).toBe(20);
    expect(normalizeHistoryMatchCount(undefined)).toBe(20);
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
      { value: 20, label: "20" },
      { value: 50, label: "50" },
      { value: 100, label: "100" },
    ]);
  });
});
