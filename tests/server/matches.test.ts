import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlayerHistoryWindow } from "~/server/matches";
import { fetchPlayerHistory } from "~/lib/faceit";

vi.mock("~/lib/faceit", async () => {
  const actual = await vi.importActual<typeof import("~/lib/faceit")>("~/lib/faceit");
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
  it("pages history until it reaches matches older than the cutoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    const ts = (daysAgo: number) =>
      Math.floor((Date.now() - daysAgo * DAY_MS) / 1000);

    mockedFetchPlayerHistory.mockImplementation(async (_playerId, _limit, offset = 0) => {
      if (offset === 0) {
        return [
          { match_id: "m-1", started_at: ts(5) },
          { match_id: "m-2", started_at: ts(10) },
        ];
      }

      if (offset === 50) {
        return [
          { match_id: "m-3", started_at: ts(20) },
          { match_id: "m-old", started_at: ts(40) },
        ];
      }

      return [];
    });

    const rows = await fetchPlayerHistoryWindow("player-1", 30);

    expect(mockedFetchPlayerHistory).toHaveBeenNthCalledWith(1, "player-1", 50, 0);
    expect(mockedFetchPlayerHistory).toHaveBeenNthCalledWith(2, "player-1", 50, 50);
    expect(mockedFetchPlayerHistory).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.match_id)).toEqual(["m-1", "m-2", "m-3"]);
  });
});
