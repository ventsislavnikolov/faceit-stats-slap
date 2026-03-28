import { describe, expect, it } from "vitest";
import { shouldEnableLeaderboardFriendLookup } from "~/lib/leaderboard-page";

describe("leaderboard page helpers", () => {
  it("disables the friends lookup until auth resolves", () => {
    expect(shouldEnableLeaderboardFriendLookup(false)).toBe(false);
    expect(shouldEnableLeaderboardFriendLookup(true)).toBe(true);
  });
});
