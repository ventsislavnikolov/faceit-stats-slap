import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "~/components/AppLayout";

const routerState = vi.hoisted(() => ({
  pathname: "/leaderboard",
  search: { player: "soavarice" } as Record<string, unknown>,
}));

vi.mock("~/components/CoinBalance", () => ({
  CoinBalance: () => <div>Coins</div>,
}));

vi.mock("~/hooks/useActiveSeason", () => ({
  useActiveSeason: () => ({ data: null, isLoading: false }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    createFileRoute: () => () => ({}),
    Link: ({
      children,
      to,
      search,
      className,
      activeProps,
      inactiveProps,
      ...props
    }: any) => {
      const isActive = to === routerState.pathname;
      const resolvedClassName = [
        className,
        isActive ? activeProps?.className : inactiveProps?.className,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <a
          {...props}
          className={resolvedClassName}
          data-search={search ? JSON.stringify(search) : undefined}
        >
          {children}
        </a>
      );
    },
    Outlet: () => <div>Outlet</div>,
    useRouter: () => ({
      navigate: vi.fn(),
    }),
    useRouterState: ({ select }: any) =>
      select({
        location: {
          pathname: routerState.pathname,
          search: routerState.search,
        },
      }),
  };
});

describe("AppLayout", () => {
  it("keeps tracked navigation links locked to the resolved player id", () => {
    routerState.pathname = "/leaderboard";
    routerState.search = {
      player: "tracked",
      resolvedPlayerId: "player-123",
    };

    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain(
      "&quot;resolvedPlayerId&quot;:&quot;player-123&quot;"
    );
  });

  it("renders leaderboard before history in the top navigation", () => {
    routerState.pathname = "/leaderboard";
    routerState.search = { player: "soavarice" };
    const html = renderToStaticMarkup(<AppLayout />);

    const livePartyIndex = html.indexOf(">Live Party<");
    const leaderboardIndex = html.indexOf(">Leaderboard<");
    const historyIndex = html.indexOf(">History<");

    expect(livePartyIndex).toBeGreaterThan(-1);
    expect(leaderboardIndex).toBeGreaterThan(livePartyIndex);
    expect(historyIndex).toBeGreaterThan(leaderboardIndex);
  });

  it("renders inactive nav items with muted styling", () => {
    routerState.pathname = "/leaderboard";
    routerState.search = { player: "soavarice" };
    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain("text-text-muted hover:text-accent");
  });
});
