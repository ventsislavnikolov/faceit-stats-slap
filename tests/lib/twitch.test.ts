import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTwitchEmbedUrl, parseTwitchEmbedParents, parseTwitchStreams } from "~/lib/twitch";
import { TWITCH_MAP } from "~/lib/constants";

const ORIGINAL_ENV = {
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env.TWITCH_CLIENT_ID = ORIGINAL_ENV.TWITCH_CLIENT_ID;
  process.env.TWITCH_CLIENT_SECRET = ORIGINAL_ENV.TWITCH_CLIENT_SECRET;
});

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

  it("treats missing data arrays as no active streams", () => {
    const result = parseTwitchStreams({}, TWITCH_MAP);
    expect(result.every((s) => !s.isLive)).toBe(true);
  });
});

describe("buildTwitchEmbedUrl", () => {
  it("includes sanitized parent domains and playback params", () => {
    const url = new URL(
      buildTwitchEmbedUrl("bachiyski", "preview.example.com:3000", [
        "https://faceit-stats-slap.vercel.app",
        " localhost ",
      ])
    );

    expect(url.origin).toBe("https://player.twitch.tv");
    expect(url.searchParams.get("channel")).toBe("bachiyski");
    expect(url.searchParams.getAll("parent")).toEqual([
      "preview.example.com",
      "faceit-stats-slap.vercel.app",
      "localhost",
    ]);
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("muted")).toBe("true");
  });
});

describe("parseTwitchEmbedParents", () => {
  it("falls back to localhost when no valid parent domains are provided", () => {
    expect(parseTwitchEmbedParents(null, ["", "  "])).toEqual(["localhost"]);
  });

  it("drops protocol-only parent candidates", () => {
    expect(parseTwitchEmbedParents("https://", ["http://"])).toEqual(["localhost"]);
  });
});

describe("fetchLiveStreams", () => {
  it("reuses the cached app token across repeated stream fetches", async () => {
    vi.resetModules();
    process.env.TWITCH_CLIENT_ID = "client-id";
    process.env.TWITCH_CLIENT_SECRET = "client-secret";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token-1",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ user_login: "bachiyski" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchLiveStreams } = await import("~/lib/twitch");

    await fetchLiveStreams(["bachiyski"]);
    await fetchLiveStreams(["kasheto88"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://id.twitch.tv/oauth2/token",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.twitch.tv/helix/streams?user_login=bachiyski",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Client-Id": "client-id",
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.twitch.tv/helix/streams?user_login=kasheto88",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      })
    );
  });

  it("refreshes the token and retries when the streams endpoint returns 401", async () => {
    vi.resetModules();
    process.env.TWITCH_CLIENT_ID = "client-id";
    process.env.TWITCH_CLIENT_SECRET = "client-secret";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "stale-token",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "fresh-token",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchLiveStreams } = await import("~/lib/twitch");

    const result = await fetchLiveStreams(["bachiyski"]);

    expect(result).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.twitch.tv/helix/streams?user_login=bachiyski",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
        }),
      })
    );
  });

  it("throws when Twitch credentials are missing", async () => {
    vi.resetModules();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;

    const { fetchLiveStreams } = await import("~/lib/twitch");

    await expect(fetchLiveStreams(["bachiyski"])).rejects.toThrow(
      "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET"
    );
  });

  it("throws for non-401 stream endpoint errors", async () => {
    vi.resetModules();
    process.env.TWITCH_CLIENT_ID = "client-id";
    process.env.TWITCH_CLIENT_SECRET = "client-secret";

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "token-1",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
    );

    const { fetchLiveStreams } = await import("~/lib/twitch");

    await expect(fetchLiveStreams(["bachiyski"])).rejects.toThrow(
      "Twitch API error: 500"
    );
  });

  it("throws when the auth endpoint rejects the token request", async () => {
    vi.resetModules();
    process.env.TWITCH_CLIENT_ID = "client-id";
    process.env.TWITCH_CLIENT_SECRET = "client-secret";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
    );

    const { fetchLiveStreams } = await import("~/lib/twitch");

    await expect(fetchLiveStreams(["bachiyski"])).rejects.toThrow(
      "Twitch auth error: 401"
    );
  });
});
