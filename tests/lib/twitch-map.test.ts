import { describe, expect, it } from "vitest";
import { getTwitchChannel, TWITCH_MAP } from "~/lib/constants";

describe("TWITCH_MAP", () => {
  it("maps the verified FACEIT IDs to the correct Twitch channels", () => {
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

  it("returns channels for the verified FACEIT IDs", () => {
    expect(getTwitchChannel("8e42d5f3-b4e9-4a67-b402-be0ac3c0260b")).toBe(
      "bachiyski"
    );
    expect(getTwitchChannel("65c93ab1-d2b2-416c-a5d1-d45452c9517d")).toBe(
      "kasheto88"
    );
    expect(getTwitchChannel("15844c99-d26e-419e-bd14-30908f502c03")).toBe(
      "soavarice"
    );
  });
});
