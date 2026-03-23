import { describe, expect, it } from "vitest";
import { getBanterCatalogSize, getBanterLine } from "~/lib/banter";

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
