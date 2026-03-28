import { describe, expect, it } from "vitest";
import {
  calculateMultiplier,
  getSeasonStatus,
  isSeasonActive,
} from "~/lib/seasons";

describe("getSeasonStatus", () => {
  it("returns upcoming when now is before starts_at", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const farFuture = new Date(Date.now() + 172_800_000).toISOString();
    expect(getSeasonStatus(future, farFuture)).toBe("upcoming");
  });

  it("returns active when now is between starts_at and ends_at", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(getSeasonStatus(past, future)).toBe("active");
  });

  it("returns completed when now is after ends_at", () => {
    const past = new Date(Date.now() - 172_800_000).toISOString();
    const lessPast = new Date(Date.now() - 86_400_000).toISOString();
    expect(getSeasonStatus(past, lessPast)).toBe("completed");
  });
});

describe("isSeasonActive", () => {
  it("returns true for active status", () => {
    expect(isSeasonActive("active")).toBe(true);
  });

  it("returns false for upcoming or completed", () => {
    expect(isSeasonActive("upcoming")).toBe(false);
    expect(isSeasonActive("completed")).toBe(false);
  });
});

describe("calculateMultiplier", () => {
  it("returns dash when either side is 0", () => {
    expect(calculateMultiplier(100, 0, 200)).toBe("—");
    expect(calculateMultiplier(100, 200, 0)).toBe("—");
  });

  it("calculates correct multiplier", () => {
    // Bet 100 on side with 200 total (after your bet = 300), other side = 300
    // Payout = floor(100/300 * 300) + 100 = 100 + 100 = 200 => 2.0x
    expect(calculateMultiplier(100, 200, 300)).toBe("2.0x");
  });
});
