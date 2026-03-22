import { describe, expect, it } from "vitest";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";

describe("resolveFaceitSearchTarget", () => {
  it("routes FACEIT match ids to the match dashboard", () => {
    expect(
      resolveFaceitSearchTarget("1-b9715630-add8-430d-a78a-1686e5b0e817")
    ).toEqual({
      kind: "match",
      value: "1-b9715630-add8-430d-a78a-1686e5b0e817",
    });
  });

  it("keeps FACEIT player nicknames on the player dashboard flow", () => {
    expect(resolveFaceitSearchTarget("soavarice")).toEqual({
      kind: "player",
      value: "soavarice",
    });
  });

  it("keeps player uuids on the player dashboard flow", () => {
    expect(resolveFaceitSearchTarget("15844c99-d26e-419e-bd14-30908f502c03")).toEqual({
      kind: "player",
      value: "15844c99-d26e-419e-bd14-30908f502c03",
    });
  });
});
