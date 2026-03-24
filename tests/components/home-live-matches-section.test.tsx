import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeLiveMatchesSection } from "~/components/HomeLiveMatchesSection";
import { getTrackedWebhookPlayerIds } from "~/lib/faceit-webhooks";

vi.mock("~/hooks/useLiveMatches", () => ({
  useLiveMatches: vi.fn(),
}));

vi.mock("~/components/LiveMatchCard", () => ({
  LiveMatchCard: ({ match, userId, userCoins }: any) => (
    <div>
      {match.matchId} {userId ?? "no-user"} {userCoins ?? 0}
    </div>
  ),
}));

import { useLiveMatches } from "~/hooks/useLiveMatches";

describe("HomeLiveMatchesSection", () => {
  it("renders loading and empty states", () => {
    vi.mocked(useLiveMatches).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);

    expect(renderToStaticMarkup(<HomeLiveMatchesSection />)).toContain(
      "Loading live matches",
    );

    vi.mocked(useLiveMatches).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    expect(renderToStaticMarkup(<HomeLiveMatchesSection />)).toContain(
      "No tracked players are live right now",
    );

    expect(vi.mocked(useLiveMatches)).toHaveBeenLastCalledWith(
      getTrackedWebhookPlayerIds(),
    );
  });

  it("renders live cards with betting context", () => {
    vi.mocked(useLiveMatches).mockReturnValue({
      data: [
        {
          matchId: "match-1",
          status: "ONGOING",
          map: "de_inferno",
          score: { faction1: 0, faction2: 0 },
          startedAt: 123,
          teams: {
            faction1: { teamId: "t1", name: "Team One", roster: [] },
            faction2: { teamId: "t2", name: "Team Two", roster: [] },
          },
          friendFaction: "faction1",
          friendIds: ["friend-1"],
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const html = renderToStaticMarkup(
      <HomeLiveMatchesSection userId="user-1" userCoins={1234} />,
    );

    expect(html).toContain("match-1");
    expect(html).toContain("user-1");
    expect(html).toContain("1234");
    expect(vi.mocked(useLiveMatches)).toHaveBeenLastCalledWith(
      getTrackedWebhookPlayerIds(),
    );
  });
});
