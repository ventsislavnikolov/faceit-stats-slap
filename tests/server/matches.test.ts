import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlayerHistory } from "~/lib/faceit";
import { fetchPlayerHistoryWindow } from "~/server/matches";

vi.mock("~/lib/faceit", async () => {
  const actual =
    await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
  return {
    ...actual,
    fetchPlayerHistory: vi.fn(),
  };
});

const mockedFetchPlayerHistory = vi.mocked(fetchPlayerHistory);
const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("fetchPlayerHistoryWindow", () => {
  it("keeps paging past the old six-page ceiling until the cutoff or an empty page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    const ts = (daysAgo: number) =>
      Math.floor((Date.now() - daysAgo * DAY_MS) / 1000);

    mockedFetchPlayerHistory.mockImplementation(
      async (_playerId, _limit, offset = 0) => {
        const page = offset / 2;
        if (page < 7) {
          return [
            { match_id: `m-${page * 2 + 1}`, started_at: ts(5) },
            { match_id: `m-${page * 2 + 2}`, started_at: ts(10) },
          ];
        }

        return [];
      }
    );

    const rows = await fetchPlayerHistoryWindow("player-1", 365, 2);

    expect(mockedFetchPlayerHistory).toHaveBeenNthCalledWith(
      1,
      "player-1",
      2,
      0
    );
    expect(mockedFetchPlayerHistory).toHaveBeenNthCalledWith(
      7,
      "player-1",
      2,
      12
    );
    expect(mockedFetchPlayerHistory).toHaveBeenNthCalledWith(
      8,
      "player-1",
      2,
      14
    );
    expect(mockedFetchPlayerHistory).toHaveBeenCalledTimes(8);
    expect(rows).toHaveLength(14);
    expect(rows[0]?.match_id).toBe("m-1");
    expect(rows[13]?.match_id).toBe("m-14");
  });
});
