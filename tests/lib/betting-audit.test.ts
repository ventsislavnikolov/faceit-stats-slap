import { describe, expect, it } from "vitest";
import { formatBetTiming } from "~/lib/betting";

describe("formatBetTiming", () => {
  it("renders concise elapsed match time for bet history", () => {
    expect(formatBetTiming(14)).toBe("Placed 14s after match start");
    expect(formatBetTiming(60)).toBe("Placed 1m 00s after match start");
    expect(formatBetTiming(134)).toBe("Placed 2m 14s after match start");
  });
});
