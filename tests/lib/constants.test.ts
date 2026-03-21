import { describe, it, expect } from "vitest";
import {
  TRACKED_FRIENDS,
  MY_FACEIT_ID,
  TWITCH_MAP,
  MAP_COLORS,
  getMapColor,
  getTwitchChannel,
} from "~/lib/constants";

describe("constants", () => {
  it("has 19 tracked friends", () => {
    expect(TRACKED_FRIENDS).toHaveLength(19);
  });

  it("MY_FACEIT_ID is soavarice", () => {
    expect(MY_FACEIT_ID).toBe("15844c99-d26e-419e-bd14-30908f502c03");
  });

  it("TWITCH_MAP maps FACEIT IDs to Twitch channels", () => {
    expect(TWITCH_MAP["ad8034c1-6324-4080-b28e-dbf04239670a"]).toBe("bachiyski");
    expect(TWITCH_MAP["65c93ab1-d2b2-416c-a5d1-d45452c9517d"]).toBe("kasheto88");
    expect(TWITCH_MAP["15844c99-d26e-419e-bd14-30908f502c03"]).toBe("soavarice");
  });

  it("getMapColor returns correct colors", () => {
    expect(getMapColor("de_inferno")).toBe("#cc9944");
    expect(getMapColor("de_dust2")).toBe("#ccaa88");
    expect(getMapColor("de_unknown")).toBe("#888888");
  });

  it("getTwitchChannel returns channel or null", () => {
    expect(getTwitchChannel("ad8034c1-6324-4080-b28e-dbf04239670a")).toBe("bachiyski");
    expect(getTwitchChannel("some-random-id")).toBeNull();
  });
});
