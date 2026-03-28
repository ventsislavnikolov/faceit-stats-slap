import { describe, expect, it } from "vitest";
import {
  buildPropDescription,
  generatePropThresholds,
} from "~/lib/prop-generation";

describe("generatePropThresholds", () => {
  it("generates kills threshold as ceil of average", () => {
    const result = generatePropThresholds({
      avgKills: 20.3,
      avgKd: 1.15,
      avgAdr: 78.4,
    });
    expect(result.kills).toBe(21);
  });

  it("generates kd threshold rounded up to 1 decimal", () => {
    const result = generatePropThresholds({
      avgKills: 18,
      avgKd: 1.15,
      avgAdr: 75,
    });
    expect(result.kd).toBe(1.2);
  });

  it("generates adr threshold as ceil of average", () => {
    const result = generatePropThresholds({
      avgKills: 18,
      avgKd: 1.0,
      avgAdr: 78.4,
    });
    expect(result.adr).toBe(79);
  });

  it("handles whole number averages by adding 1", () => {
    const result = generatePropThresholds({
      avgKills: 20,
      avgKd: 1.0,
      avgAdr: 80,
    });
    expect(result.kills).toBe(21);
    expect(result.adr).toBe(81);
  });
});

describe("buildPropDescription", () => {
  it("formats kills prop", () => {
    expect(buildPropDescription("Flaw1esss", "kills", 21)).toBe(
      "Flaw1esss 21+ kills"
    );
  });

  it("formats kd prop with 1 decimal", () => {
    expect(buildPropDescription("TibaBG", "kd", 1.2)).toBe("TibaBG 1.2+ K/D");
  });

  it("formats adr prop", () => {
    expect(buildPropDescription("soavarice", "adr", 79)).toBe(
      "soavarice 79+ ADR"
    );
  });
});
