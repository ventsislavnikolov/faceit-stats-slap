import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: {
    player: undefined as string | undefined,
    date: undefined as string | undefined,
  },
  navigate: vi.fn(),
  query: { data: null as any, isLoading: false, isError: false },
  session: { data: null as any, isLoading: false },
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
    lazyRouteComponent: (component: unknown) => component,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mocks.query,
}));

vi.mock("~/hooks/usePartySession", () => ({
  usePartySession: () => mocks.session,
}));

vi.mock("~/server/friends", () => ({
  resolvePlayer: vi.fn(),
}));

vi.mock("~/components/PlayerSearchHeader", () => ({
  PlayerSearchHeader: () => <div>Player search header</div>,
}));

vi.mock("~/components/last-party/LastPartyHeader", () => ({
  LastPartyHeader: () => <div>LastPartyHeader</div>,
}));

vi.mock("~/components/last-party/SessionPodium", () => ({
  SessionPodium: () => <div>Session podium</div>,
}));

vi.mock("~/components/last-party/SessionRivalryCards", () => ({
  SessionRivalryCards: () => <div>Rivalry cards</div>,
}));

vi.mock("~/components/last-party/PartyAwards", () => ({
  PartyAwards: () => <div>Party awards</div>,
}));

vi.mock("~/components/last-party/SessionStatsTable", () => ({
  SessionStatsTable: () => <div>Session stats table</div>,
}));

vi.mock("~/components/last-party/MapDistribution", () => ({
  MapDistribution: () => <div>Map distribution</div>,
}));

vi.mock("~/components/last-party/MatchAccordion", () => ({
  MatchAccordion: () => <div>Match accordion</div>,
}));

vi.mock("~/components/last-party/SessionAnalyst", () => ({
  SessionAnalyst: () => <div>Session analyst</div>,
}));

import { LastPartyPage } from "~/routes/_authed/last-party";

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-04-03",
    lossCount: 1,
    winCount: 2,
    totalHoursPlayed: 4.5,
    matches: [{ matchId: "match-1" }],
    partyMembers: [{ faceitId: "player-1" }],
    allHaveDemo: true,
    awards: [],
    aggregateStats: {},
    mapDistribution: [],
    demoMatches: [],
    matchStats: {},
    eloMap: {},
    rivalries: {
      podium: [{ faceitId: "player-1" }],
      rivalryCards: [{ title: "Owned the lobby" }],
    },
    ...overrides,
  };
}

function renderRoute() {
  return renderToStaticMarkup(<LastPartyPage />);
}

describe("/last-party route", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.search = { player: "soavarice", date: "2026-04-03" };
    mocks.query = {
      data: { faceitId: "player-1", nickname: "soavarice" },
      isLoading: false,
      isError: false,
    };
    mocks.session = {
      data: buildSession(),
      isLoading: false,
    };
  });

  it("renders rivalry sections for a populated session", () => {
    const html = renderRoute();

    expect(html).toContain("LastPartyHeader");
    expect(html).toContain("Session podium");
    expect(html).toContain("Rivalry cards");
    expect(html).toContain("Party awards");
    expect(html).toContain("Session stats table");
    expect(html).toContain("Map distribution");
    expect(html).toContain("Match accordion");
    expect(html).toContain("Session analyst");
  });

  it("degrades cleanly when rivalry data is missing", () => {
    mocks.session = {
      data: buildSession({ rivalries: undefined }),
      isLoading: false,
    };

    const html = renderRoute();

    expect(html).toContain("LastPartyHeader");
    expect(html).toContain("Party awards");
    expect(html).toContain("Session stats table");
    expect(html).toContain("Map distribution");
    expect(html).toContain("Match accordion");
    expect(html).toContain("Session analyst");
    expect(html).not.toContain("Session podium");
    expect(html).not.toContain("Rivalry cards");
  });

  it("includes rivalry placeholders in the loading skeleton", () => {
    mocks.query = {
      data: null,
      isLoading: true,
      isError: false,
    };
    mocks.session = {
      data: null,
      isLoading: true,
    };

    const html = renderRoute();

    expect(html).toContain('data-testid="last-party-podium-skeleton"');
    expect(html).toContain('data-testid="last-party-rivalry-skeleton"');
  });

  it("still renders the empty state when no matches exist", () => {
    mocks.session = {
      data: buildSession({ matches: [] }),
      isLoading: false,
    };

    const html = renderRoute();

    expect(html).toContain(
      "No party matches found on this date. Try selecting a different day."
    );
    expect(html).not.toContain("Session podium");
    expect(html).not.toContain("Rivalry cards");
  });
});
