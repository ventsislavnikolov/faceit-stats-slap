import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "~/components/AppLayout";

vi.mock("~/components/CoinBalance", () => ({
  CoinBalance: () => <div>Coins</div>,
}));

vi.mock("~/hooks/useActiveSeason", () => ({
  useActiveSeason: () => ({ data: null, isLoading: false }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  const currentPathname = "/leaderboard";

  return {
    ...actual,
    createFileRoute: () => () => ({}),
    Link: ({
      children,
      to,
      className,
      activeProps,
      inactiveProps,
      ...props
    }: any) => {
      const isActive = to === currentPathname;
      const resolvedClassName = [
        className,
        isActive ? activeProps?.className : inactiveProps?.className,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <a {...props} className={resolvedClassName}>
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
          pathname: currentPathname,
          search: { player: "soavarice" },
        },
      }),
  };
});

describe("AppLayout", () => {
  it("renders leaderboard before history in the top navigation", () => {
    const html = renderToStaticMarkup(<AppLayout />);

    const livePartyIndex = html.indexOf(">Live Party<");
    const leaderboardIndex = html.indexOf(">Leaderboard<");
    const historyIndex = html.indexOf(">History<");

    expect(livePartyIndex).toBeGreaterThan(-1);
    expect(leaderboardIndex).toBeGreaterThan(livePartyIndex);
    expect(historyIndex).toBeGreaterThan(leaderboardIndex);
  });

  it("renders inactive nav items with muted styling", () => {
    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain("text-text-muted hover:text-accent");
  });
});
