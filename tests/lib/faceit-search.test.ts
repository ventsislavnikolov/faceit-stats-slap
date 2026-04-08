import { describe, expect, it } from "vitest";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";

describe("resolveFaceitSearchTarget", () => {
  it("treats sborka as a reserved player alias", () => {
    expect(resolveFaceitSearchTarget("sborka")).toEqual({
      kind: "player",
      value: "sborka",
    });
  });

  it("canonicalizes sborka alias input before routing", () => {
    expect(resolveFaceitSearchTarget("  SbOrKa  ")).toEqual({
      kind: "player",
      value: "sborka",
    });
  });

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
    expect(
      resolveFaceitSearchTarget("15844c99-d26e-419e-bd14-30908f502c03")
    ).toEqual({
      kind: "player",
      value: "15844c99-d26e-419e-bd14-30908f502c03",
    });
  });

  it("extracts the nickname from a FACEIT profile url", () => {
    expect(
      resolveFaceitSearchTarget("https://www.faceit.com/en/players/soavarice")
    ).toEqual({
      kind: "player",
      value: "soavarice",
    });
  });

  it("extracts the nickname from a FACEIT profile url with extra path details", () => {
    expect(
      resolveFaceitSearchTarget(
        " https://www.faceit.com/en/players/soavarice/stats/cs2 "
      )
    ).toEqual({
      kind: "player",
      value: "soavarice",
    });
  });

  it("extracts nicknames from FACEIT profile urls without an explicit protocol", () => {
    expect(
      resolveFaceitSearchTarget("faceit.com/en/players/soavarice")
    ).toEqual({
      kind: "player",
      value: "soavarice",
    });
  });

  it("keeps non-FACEIT urls on the player dashboard flow", () => {
    expect(
      resolveFaceitSearchTarget("https://example.com/en/players/soavarice")
    ).toEqual({
      kind: "player",
      value: "https://example.com/en/players/soavarice",
    });
  });

  it("keeps malformed FACEIT profile urls on the player dashboard flow", () => {
    expect(
      resolveFaceitSearchTarget("https://www.faceit.com/en/players/%E0%A4%A")
    ).toEqual({
      kind: "player",
      value: "https://www.faceit.com/en/players/%E0%A4%A",
    });
  });

  it("keeps incomplete FACEIT profile urls on the player dashboard flow", () => {
    expect(
      resolveFaceitSearchTarget("https://www.faceit.com/en/players")
    ).toEqual({
      kind: "player",
      value: "https://www.faceit.com/en/players",
    });
  });

  it("keeps FACEIT urls without a player segment on the player dashboard flow", () => {
    expect(resolveFaceitSearchTarget("https://www.faceit.com/en/home")).toEqual(
      {
        kind: "player",
        value: "https://www.faceit.com/en/home",
      }
    );
  });
});
