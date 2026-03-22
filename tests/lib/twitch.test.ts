import { describe, it, expect } from "vitest";
import { buildTwitchEmbedUrl, parseTwitchStreams } from "~/lib/twitch";
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

describe("buildTwitchEmbedUrl", () => {
  it("includes sanitized parent domains and playback params", () => {
    const url = new URL(
      buildTwitchEmbedUrl("bachiyski", "preview.example.com:3000", [
        "https://faceit-friends-live.vercel.app",
        " localhost ",
      ])
    );

    expect(url.origin).toBe("https://player.twitch.tv");
    expect(url.searchParams.get("channel")).toBe("bachiyski");
    expect(url.searchParams.getAll("parent")).toEqual([
      "preview.example.com",
      "faceit-friends-live.vercel.app",
      "localhost",
    ]);
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("muted")).toBe("true");
  });
});
