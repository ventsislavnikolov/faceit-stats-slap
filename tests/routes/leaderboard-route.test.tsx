import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {
    player: undefined as string | undefined,
    resolvedPlayerId: undefined as string | undefined,
    matches: 20 as 20 | 50 | 100,
    queue: "party" as "all" | "solo" | "party",
    last: 30 as 30 | 90 | 180 | 365 | 730,
  },
  navigate: vi.fn(),
  trackedTarget: {
    data: null as any,
    isLoading: false,
    isError: false,
    isTrackedFlow: false,
  },
  query: {
    data: null as any,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) =>
      ({
        ...options,
        options,
        useSearch: () => mocks.search,
      }) as any,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mocks.query,
}));

vi.mock("~/hooks/useTrackedPlayerTarget", () => ({
  useTrackedPlayerTarget: () => mocks.trackedTarget,
}));

vi.mock("~/hooks/useStatsLeaderboard", () => ({
  useStatsLeaderboard: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("~/hooks/useSyncPlayerHistory", () => ({
  useSyncPlayerHistory: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("~/components/PlayerSearchHeader", () => ({
  PlayerSearchHeader: () => <div>Player search header</div>,
}));

vi.mock("~/components/PageSectionTabs", () => ({
  PageSectionTabs: () => <div>Section tabs</div>,
}));

import { LeaderboardPage } from "~/routes/_authed/leaderboard";

describe("/leaderboard route", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.search = {
      player: "sborka",
      resolvedPlayerId: undefined,
      matches: 20,
      queue: "party",
      last: 30,
    };
    mocks.trackedTarget = {
      data: null,
      isLoading: false,
      isError: false,
      isTrackedFlow: true,
    };
    mocks.query = {
      data: null,
      isLoading: false,
      isError: false,
    };
  });

  it("renders the tracked-specific empty state when no tracked player qualifies", () => {
    const html = renderToStaticMarkup(<LeaderboardPage />);

    expect(html).toContain(
      "No tracked player has leaderboard data for these filters."
    );
  });
});
