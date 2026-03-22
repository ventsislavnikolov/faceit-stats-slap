import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithStartContext } from "../../node_modules/.pnpm/@tanstack+start-storage-context@1.166.15/node_modules/@tanstack/start-storage-context/dist/esm/index.js";
import { searchAndLoadFriends } from "~/server/friends";
import { fetchPlayerByNickname } from "~/lib/faceit";

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
});
