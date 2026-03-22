import { describe, it, expect } from "vitest";
import { getBanterLine } from "../../src/lib/banter";

describe("getBanterLine", () => {
  it("returns a carry line containing the player name", () => {
    const line = getBanterLine("carry", "F1aw1esss", "match-123");
    expect(line).toContain("F1aw1esss");
  });

  it("returns a roast line containing the player name", () => {
    const line = getBanterLine("roast", "eLfen0men0", "match-456");
    expect(line).toContain("eLfen0men0");
  });

  it("is deterministic for the same matchId", () => {
    const a = getBanterLine("carry", "Test", "match-abc");
    const b = getBanterLine("carry", "Test", "match-abc");
    expect(a).toBe(b);
  });

  it("produces different lines for different matchIds", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(getBanterLine("carry", "X", `match-${i}`));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
