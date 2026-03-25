import { describe, expect, it } from "vitest";
import * as constants from "~/lib/constants";

const { MY_FACEIT_ID, TWITCH_MAP, MAP_COLORS, getMapColor, getTwitchChannel } =
  constants;

describe("constants", () => {
  it("does not export the removed TRACKED_FRIENDS constant", () => {
    expect(constants).not.toHaveProperty("TRACKED_FRIENDS");
  });

  it("MY_FACEIT_ID is soavarice", () => {
    expect(MY_FACEIT_ID).toBe("15844c99-d26e-419e-bd14-30908f502c03");
  });

  it("TWITCH_MAP maps FACEIT IDs to Twitch channels", () => {
    expect(TWITCH_MAP["8e42d5f3-b4e9-4a67-b402-be0ac3c0260b"]).toBe(
      "bachiyski"
    );
    expect(TWITCH_MAP["65c93ab1-d2b2-416c-a5d1-d45452c9517d"]).toBe(
      "kasheto88"
    );
    expect(TWITCH_MAP["15844c99-d26e-419e-bd14-30908f502c03"]).toBe(
      "soavarice"
    );
  });

  it("getMapColor returns correct colors", () => {
    expect(getMapColor("de_inferno")).toBe("#cc9944");
    expect(getMapColor("de_dust2")).toBe("#ccaa88");
    expect(getMapColor("de_unknown")).toBe("#888888");
  });

  it("getTwitchChannel returns channel or null", () => {
    expect(getTwitchChannel("8e42d5f3-b4e9-4a67-b402-be0ac3c0260b")).toBe(
      "bachiyski"
    );
    expect(getTwitchChannel("some-random-id")).toBeNull();
  });
});
