import { describe, expect, it } from "vitest";
import { filterUnsyncedHistoryItems } from "~/lib/history-sync";

describe("filterUnsyncedHistoryItems", () => {
  it("keeps only missing match ids and preserves first-seen order", () => {
    expect(
      filterUnsyncedHistoryItems(
        [
          { match_id: "match-1" },
          { match_id: "match-2" },
          { match_id: "match-2" },
          { match_id: "match-3" },
        ],
        ["match-1", "match-4"]
      )
    ).toEqual([{ match_id: "match-2" }, { match_id: "match-3" }]);
  });

  it("drops rows without a usable match id", () => {
    expect(
      filterUnsyncedHistoryItems(
        [{ match_id: "" }, {} as any, { match_id: "match-2" }],
        []
      )
    ).toEqual([{ match_id: "match-2" }]);
  });
});
