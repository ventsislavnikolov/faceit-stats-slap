import { describe, expect, it } from "vitest";
import { getBanterCatalogSize } from "~/lib/banter";

describe("getBanterCatalogSize", () => {
  it("keeps a larger rotation for carry and roast lines", () => {
    expect(getBanterCatalogSize("carry")).toBeGreaterThanOrEqual(35);
    expect(getBanterCatalogSize("roast")).toBeGreaterThanOrEqual(35);
  });
});
