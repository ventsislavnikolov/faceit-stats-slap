import { describe, expect, it } from "vitest";
import {
  getPlayerViewHref,
  getPlayerViewTabs,
  type PlayerView,
} from "~/lib/player-view-shell";

describe("player view shell", () => {
  it("builds consistent hrefs for all three player views", () => {
    expect(getPlayerViewHref("friends", "soavarice")).toEqual({
      to: "/$nickname",
      params: { nickname: "soavarice" },
    });

    expect(getPlayerViewHref("history", "soavarice")).toEqual({
      to: "/history",
      search: {
        player: "soavarice",
        matches: "yesterday",
        queue: "party",
      },
    });

    expect(getPlayerViewHref("leaderboard", "soavarice")).toEqual({
      to: "/leaderboard",
      search: {
        player: "soavarice",
      },
    });
  });

  it("marks the active player view and disables nav without a nickname", () => {
    const tabs = getPlayerViewTabs({
      activeView: "history",
      nickname: null,
    });

    expect(tabs.map((tab) => ({ label: tab.label, isActive: tab.isActive, isDisabled: tab.isDisabled }))).toEqual([
      { label: "Friends", isActive: false, isDisabled: true },
      { label: "History", isActive: true, isDisabled: true },
      { label: "Leaderboard", isActive: false, isDisabled: true },
    ]);
  });

  it("keeps all player views in a stable order", () => {
    expect(getPlayerViewTabs({ activeView: "leaderboard", nickname: "soavarice" }).map((tab) => tab.view)).toEqual([
      "friends",
      "history",
      "leaderboard",
    ] satisfies PlayerView[]);
  });
});
