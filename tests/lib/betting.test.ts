import { describe, it, expect } from "vitest";
import { calculatePayout, calculateReturnPct, isBettingOpen } from "~/lib/betting";

describe("calculatePayout", () => {
  it("splits losing pool proportionally", () => {
    expect(calculatePayout(200, 600, 400)).toBe(333);
  });

  it("returns full bet when winning side is the only side", () => {
    expect(calculatePayout(200, 200, 0)).toBe(200);
  });

  it("returns full bet when losing side is 0", () => {
    expect(calculatePayout(100, 500, 0)).toBe(100);
  });

  it("handles equal pools", () => {
    expect(calculatePayout(100, 200, 200)).toBe(200);
  });
});

describe("calculateReturnPct", () => {
  it("returns positive % gain", () => {
    expect(calculateReturnPct(200, 600, 400)).toBe(66);
  });

  it("returns 0% when no losers", () => {
    expect(calculateReturnPct(200, 200, 0)).toBe(0);
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
