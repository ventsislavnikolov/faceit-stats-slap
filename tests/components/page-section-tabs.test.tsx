import { describe, expect, it } from "vitest";
import { shouldRenderPageSectionTabs } from "~/components/PageSectionTabs";

describe("page section tabs", () => {
  it("renders the tab strip only when there are multiple tabs", () => {
    expect(shouldRenderPageSectionTabs([])).toBe(false);
    expect(shouldRenderPageSectionTabs([{ key: "stats", label: "Stats" }])).toBe(false);
    expect(
      shouldRenderPageSectionTabs([
        { key: "stats", label: "Stats" },
        { key: "bets", label: "Bets" },
      ]),
    ).toBe(true);
  });
});
