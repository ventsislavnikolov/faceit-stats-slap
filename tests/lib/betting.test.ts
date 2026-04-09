import { describe, expect, it } from "vitest";
import { calculatePayout, calculateReturnPct, isBettingOpen } from "~/lib/betting";

describe("calculatePayout", () => {
  it("returns 2x the bet amount", () => {
    expect(calculatePayout(200)).toBe(400);
  });

  it("returns 2x for any amount", () => {
    expect(calculatePayout(100)).toBe(200);
    expect(calculatePayout(450)).toBe(900);
    expect(calculatePayout(1)).toBe(2);
  });
});

describe("calculateReturnPct", () => {
  it("always returns 100%", () => {
    expect(calculateReturnPct()).toBe(100);
  });
});

describe("isBettingOpen", () => {
  it("returns true when before closes_at", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBettingOpen("OPEN", future)).toBe(true);
  });

  it("returns false when past closes_at", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isBettingOpen("OPEN", past)).toBe(false);
  });

  it("returns false when status is CLOSED", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBettingOpen("CLOSED", future)).toBe(false);
  });
});
