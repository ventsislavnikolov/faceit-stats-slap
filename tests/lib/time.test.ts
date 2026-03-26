import { describe, expect, it } from "vitest";
import {
  getCalendarDayRange,
  getYesterdayDateString,
} from "../../src/lib/time";

describe("getCalendarDayRange", () => {
  it("returns correct start/end for a given date string", () => {
    const result = getCalendarDayRange("2026-03-25");
    expect(result.startUnix).toBeLessThan(result.endUnix);
    expect(result.endUnix - result.startUnix).toBe(86_400);
    expect(result.startIso).toContain("2026-03-24T22:00:00");
  });

  it("handles DST transition date", () => {
    const result = getCalendarDayRange("2026-03-29");
    expect(result.endUnix).toBeGreaterThan(result.startUnix);
  });
});

describe("getYesterdayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getYesterdayDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
