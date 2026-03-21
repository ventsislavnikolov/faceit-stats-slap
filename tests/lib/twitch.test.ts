import { describe, it, expect } from "vitest";
import { parseTwitchStreams } from "~/lib/twitch";
import { TWITCH_MAP } from "~/lib/constants";

describe("parseTwitchStreams", () => {
  it("maps live Twitch data to TwitchStream objects", () => {
    const apiResponse = {
      data: [
        {
          user_login: "bachiyski",
          viewer_count: 142,
          title: "CS2 Ranked",
          thumbnail_url: "https://thumb.jpg",
        },
      ],
    };
    const result = parseTwitchStreams(apiResponse, TWITCH_MAP);
    expect(result).toHaveLength(3); // all 3 channels
    const live = result.find((s) => s.channel === "bachiyski");
    expect(live?.isLive).toBe(true);
    expect(live?.viewerCount).toBe(142);
    const offline = result.find((s) => s.channel === "kasheto88");
    expect(offline?.isLive).toBe(false);
  });

  it("handles empty data (no one live)", () => {
    const result = parseTwitchStreams({ data: [] }, TWITCH_MAP);
    expect(result.every((s) => !s.isLive)).toBe(true);
  });
});
