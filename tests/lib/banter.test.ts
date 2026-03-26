import { describe, expect, it } from "vitest";
import {
  getBanterCatalogSize,
  getBanterLine,
  getSessionBanterLine,
} from "~/lib/banter";

describe("getBanterCatalogSize", () => {
  it("keeps a larger rotation for carry and roast lines", () => {
    expect(getBanterCatalogSize("carry")).toBeGreaterThanOrEqual(35);
    expect(getBanterCatalogSize("roast")).toBeGreaterThanOrEqual(35);
  });
});

describe("getBanterLine", () => {
  it("returns deterministic carry banter for the same input", () => {
    const first = getBanterLine("carry", "soavarice", "match-1");
    const second = getBanterLine("carry", "soavarice", "match-1");

    expect(first).toBe(second);
    expect(first).toContain("soavarice");
  });

  it("uses the roast catalog for roast banter", () => {
    const line = getBanterLine("roast", "TibaBG", "match-2");

    expect(line).toContain("TibaBG");
    expect(line).not.toBe(getBanterLine("carry", "TibaBG", "match-2"));
  });
});

describe("getSessionBanterLine", () => {
  it("returns a carry line with name interpolated", () => {
    const line = getSessionBanterLine(
      "carry",
      "soavarice",
      "abc123",
      "2026-03-25"
    );
    expect(line).toContain("soavarice");
    expect(line.length).toBeGreaterThan(0);
  });

  it("returns a roast line with name interpolated", () => {
    const line = getSessionBanterLine(
      "roast",
      "noob123",
      "abc123",
      "2026-03-25"
    );
    expect(line).toContain("noob123");
  });

  it("is deterministic for same inputs", () => {
    const a = getSessionBanterLine(
      "carry",
      "soavarice",
      "abc123",
      "2026-03-25"
    );
    const b = getSessionBanterLine(
      "carry",
      "soavarice",
      "abc123",
      "2026-03-25"
    );
    expect(a).toBe(b);
  });

  it("varies by date", () => {
    const a = getSessionBanterLine(
      "carry",
      "soavarice",
      "abc123",
      "2026-03-25"
    );
    const b = getSessionBanterLine(
      "carry",
      "soavarice",
      "abc123",
      "2026-03-26"
    );
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});
