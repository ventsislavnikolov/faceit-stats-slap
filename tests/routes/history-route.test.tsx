import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {
    player: undefined as string | undefined,
    resolvedPlayerId: undefined as string | undefined,
    matches: 20 as 20 | 50 | 100,
    queue: "party" as "all" | "solo" | "party",
  },
  navigate: vi.fn(),
  trackedTarget: {
    data: null as any,
    isLoading: false,
    isError: false,
    isTrackedFlow: false,
  },
  playerStats: {
    data: [] as any[],
    isLoading: false,
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

vi.mock("~/hooks/useTrackedPlayerTarget", () => ({
  useTrackedPlayerTarget: () => mocks.trackedTarget,
}));

vi.mock("~/hooks/usePlayerStats", () => ({
  usePlayerStats: () => mocks.playerStats,
}));

vi.mock("~/components/PlayerSearchHeader", () => ({
  PlayerSearchHeader: () => <div>Player search header</div>,
}));

vi.mock("~/components/HistoryMatchesTable", () => ({
  HistoryMatchesTable: () => <div>History matches table</div>,
}));

import { HistoryPage } from "~/routes/_authed/history";

describe("/history route", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.search = {
      player: "sborka",
      resolvedPlayerId: undefined,
      matches: 20,
      queue: "party",
    };
    mocks.trackedTarget = {
      data: null,
      isLoading: false,
      isError: false,
      isTrackedFlow: true,
    };
    mocks.playerStats = {
      data: [],
      isLoading: false,
    };
  });

  it("renders the tracked-specific empty state when no tracked player qualifies", () => {
    const html = renderToStaticMarkup(<HistoryPage />);

    expect(html).toContain(
      "No tracked player has matching history for these filters."
    );
  });
});
