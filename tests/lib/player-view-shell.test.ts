import { describe, expect, it } from "vitest";
import {
  getPlayerViewHref,
  getPlayerViewTabs,
  type PlayerView,
} from "~/lib/player-view-shell";

describe("player view shell", () => {
  it("carries a locked resolved player id when the source player is tracked", () => {
    expect(
      getPlayerViewHref("history", "tracked", {
        resolvedPlayerId: "player-123",
      })
    ).toEqual({
      to: "/history",
      search: {
        player: "tracked",
        resolvedPlayerId: "player-123",
        matches: 20,
        queue: "party",
      },
    });
  });

  it("builds /tracked for the tracked friends view", () => {
    expect(getPlayerViewHref("friends", "tracked")).toEqual({
      to: "/tracked",
    });
  });

  it("builds consistent hrefs for all three player views", () => {
    expect(getPlayerViewHref("friends", "soavarice")).toEqual({
      to: "/$nickname",
      params: { nickname: "soavarice" },
    });

    expect(getPlayerViewHref("history", "soavarice")).toEqual({
      to: "/history",
      search: {
        player: "soavarice",
        matches: 20,
        queue: "party",
      },
    });

    expect(getPlayerViewHref("leaderboard", "soavarice")).toEqual({
      to: "/leaderboard",
      search: {
        player: "soavarice",
        matches: 20,
        queue: "party",
        last: 30,
      },
    });
  });

  it("marks the active player view and disables nav without a nickname", () => {
    const tabs = getPlayerViewTabs({
      activeView: "history",
      nickname: null,
    });

    expect(
      tabs.map((tab) => ({
        label: tab.label,
        isActive: tab.isActive,
        isDisabled: tab.isDisabled,
      }))
    ).toEqual([
      { label: "Friends", isActive: false, isDisabled: true },
      { label: "Last Party", isActive: false, isDisabled: true },
      { label: "History", isActive: true, isDisabled: true },
      { label: "Leaderboard", isActive: false, isDisabled: true },
    ]);
  });

  it("keeps all player views in a stable order", () => {
    expect(
      getPlayerViewTabs({
        activeView: "leaderboard",
        nickname: "soavarice",
      }).map((tab) => tab.view)
    ).toEqual([
      "friends",
      "last-party",
      "history",
      "leaderboard",
    ] satisfies PlayerView[]);
  });

  it("preserves locked tracked resolution metadata in shell-generated tabs", () => {
    expect(
      getPlayerViewTabs({
        activeView: "history",
        nickname: "tracked",
        locked: {
          resolvedPlayerId: "player-123",
        },
      }).map((tab) => tab.href)
    ).toEqual([
      {
        to: "/tracked",
        search: {
          resolvedPlayerId: "player-123",
        },
      },
      {
        to: "/last-party",
        search: {
          player: "tracked",
          resolvedPlayerId: "player-123",
        },
      },
      {
        to: "/history",
        search: {
          player: "tracked",
          resolvedPlayerId: "player-123",
          matches: 20,
          queue: "party",
        },
      },
      {
        to: "/leaderboard",
        search: {
          player: "tracked",
          resolvedPlayerId: "player-123",
          matches: 20,
          queue: "party",
          last: 30,
        },
      },
    ]);
  });

  it("does not leak locked resolution metadata into ordinary player tabs", () => {
    expect(
      getPlayerViewTabs({
        activeView: "history",
        nickname: "soavarice",
        locked: {
          resolvedPlayerId: "player-123",
        },
      }).map((tab) => tab.href)
    ).toEqual([
      {
        to: "/$nickname",
        params: { nickname: "soavarice" },
      },
      {
        to: "/last-party",
        search: {
          player: "soavarice",
        },
      },
      {
        to: "/history",
        search: {
          player: "soavarice",
          matches: 20,
          queue: "party",
        },
      },
      {
        to: "/leaderboard",
        search: {
          player: "soavarice",
          matches: 20,
          queue: "party",
          last: 30,
        },
      },
    ]);
  });

  it("canonicalizes tracked search player values in shell-generated non-friends tabs", () => {
    expect(
      getPlayerViewHref("history", "  TrAcKeD  ", {
        resolvedPlayerId: "player-123",
      })
    ).toEqual({
      to: "/history",
      search: {
        player: "tracked",
        resolvedPlayerId: "player-123",
        matches: 20,
        queue: "party",
      },
    });
  });
});
