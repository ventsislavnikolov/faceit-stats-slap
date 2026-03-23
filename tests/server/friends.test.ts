import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import { resolvePlayer, searchAndLoadFriends } from "~/server/friends";
import {
  fetchPlayer,
  fetchPlayerByNickname,
  fetchPlayerLifetimeStats,
} from "~/lib/faceit";

vi.mock("~/lib/faceit", async () => {
  const actual = await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
  return {
    ...actual,
    fetchPlayerByNickname: vi.fn(),
    fetchPlayerLifetimeStats: vi.fn(),
    fetchPlayer: vi.fn(),
  };
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("resolvePlayer", () => {
  it("uses the direct player lookup for uuid inputs", async () => {
    vi.mocked(fetchPlayer).mockResolvedValue({
      faceitId: "15844c99-d26e-419e-bd14-30908f502c03",
      nickname: "soavarice",
      avatar: "",
      elo: 1690,
      skillLevel: 8,
      country: "BG",
      friendsIds: [],
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        resolvePlayer({
          data: "15844c99-d26e-419e-bd14-30908f502c03",
        } as any)
    );

    expect(fetchPlayer).toHaveBeenCalledWith("15844c99-d26e-419e-bd14-30908f502c03");
    expect(fetchPlayerByNickname).not.toHaveBeenCalled();
    expect(result).toEqual({
      faceitId: "15844c99-d26e-419e-bd14-30908f502c03",
      nickname: "soavarice",
    });
  });

  it("uses nickname lookup for non-uuid inputs", async () => {
    vi.mocked(fetchPlayerByNickname).mockResolvedValue({
      faceitId: "player-1",
      nickname: "SoAvarice",
      avatar: "",
      elo: 1690,
      skillLevel: 8,
      country: "BG",
      friendsIds: [],
    });

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => resolvePlayer({ data: " SoAvarice " } as any)
    );

    expect(fetchPlayerByNickname).toHaveBeenCalledWith("SoAvarice");
    expect(fetchPlayer).not.toHaveBeenCalled();
    expect(result).toEqual({
      faceitId: "player-1",
      nickname: "SoAvarice",
    });
  });
});

describe("searchAndLoadFriends", () => {
  it("preserves nickname casing when resolving the searched player", async () => {
    vi.mocked(fetchPlayerByNickname).mockResolvedValue({
      faceitId: "player-1",
      nickname: "SoAvarice",
      avatar: "",
      elo: 0,
      skillLevel: 0,
      country: "BG",
      friendsIds: [],
    });

    await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => searchAndLoadFriends({ data: "SoAvarice" } as any)
    );

    expect(fetchPlayerByNickname).toHaveBeenCalledWith("SoAvarice");
  });

  it("uses uuid lookup, caps to 20 friends, and loads friend stats in batches", async () => {
    vi.useFakeTimers();

    const friendIds = Array.from({ length: 21 }, (_, index) => `friend-${index + 1}`);
    vi.mocked(fetchPlayer).mockImplementation(async (faceitId: string) => {
      if (faceitId === "15844c99-d26e-419e-bd14-30908f502c03") {
        return {
          faceitId,
          nickname: "soavarice",
          avatar: "",
          elo: 1690,
          skillLevel: 8,
          country: "BG",
          friendsIds: friendIds,
        };
      }

      return {
        faceitId,
        nickname: faceitId,
        avatar: "",
        elo: 1000,
        skillLevel: 5,
        country: "BG",
        friendsIds: [],
      };
    });
    vi.mocked(fetchPlayerLifetimeStats).mockImplementation(async () => ({
      lifetimeKd: 1.1,
      lifetimeHs: 45,
      lifetimeAdr: 80,
      winRate: 55,
      totalMatches: 200,
      recentResults: [true, false, true],
    }));

    const promise = runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () =>
        searchAndLoadFriends({
          data: "15844c99-d26e-419e-bd14-30908f502c03",
        } as any)
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchPlayer).toHaveBeenCalledWith("15844c99-d26e-419e-bd14-30908f502c03");
    expect(fetchPlayerByNickname).not.toHaveBeenCalled();
    expect(result.player).toEqual({
      faceitId: "15844c99-d26e-419e-bd14-30908f502c03",
      nickname: "soavarice",
    });
    expect(result.totalFriends).toBe(21);
    expect(result.limited).toBe(true);
    expect(result.friends).toHaveLength(20);
    expect(result.friends[0]).toEqual(
      expect.objectContaining({
        faceitId: "friend-1",
        nickname: "friend-1",
        twitchChannel: null,
        isPlaying: false,
        currentMatchId: null,
      })
    );
    expect(vi.mocked(fetchPlayerLifetimeStats)).toHaveBeenCalledTimes(20);
  });

  it("keeps fulfilled friends when one batched lookup fails", async () => {
    vi.mocked(fetchPlayerByNickname).mockResolvedValue({
      faceitId: "player-1",
      nickname: "SoAvarice",
      avatar: "",
      elo: 0,
      skillLevel: 0,
      country: "BG",
      friendsIds: ["friend-1", "friend-2"],
    });
    vi.mocked(fetchPlayer).mockImplementation(async (faceitId: string) => ({
      faceitId,
      nickname: faceitId,
      avatar: "",
      elo: 1000,
      skillLevel: 5,
      country: "BG",
      friendsIds: [],
    }));
    vi.mocked(fetchPlayerLifetimeStats)
      .mockResolvedValueOnce({
        lifetimeKd: 1.1,
        lifetimeHs: 45,
        lifetimeAdr: 80,
        winRate: 55,
        totalMatches: 200,
        recentResults: [true, false, true],
      })
      .mockRejectedValueOnce(new Error("stats unavailable"));

    const result = await runWithStartContext(
      {
        contextAfterGlobalMiddlewares: {},
        request: new Request("http://localhost"),
      } as any,
      () => searchAndLoadFriends({ data: "SoAvarice" } as any)
    );

    expect(result.friends).toHaveLength(1);
    expect(result.friends[0]).toEqual(
      expect.objectContaining({
        faceitId: "friend-1",
      })
    );
  });
});
