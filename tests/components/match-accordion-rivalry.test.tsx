import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MatchAccordion } from "~/components/last-party/MatchAccordion";
import type { MatchPlayerStats, PlayerHistoryMatch } from "~/lib/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: string }) => <span>{children}</span>,
}));

const makePlayer = (
  overrides: Partial<MatchPlayerStats> & { playerId: string; nickname: string }
): MatchPlayerStats => ({
  adr: 80,
  assists: 3,
  clutchKills: 0,
  damage: 1600,
  deaths: 15,
  doubleKills: 0,
  enemiesFlashed: 2,
  entryCount: 3,
  entryWins: 1,
  firstKills: 1,
  flashCount: 5,
  headshots: 8,
  hsPercent: 50,
  kdRatio: 1.0,
  kills: 15,
  krRatio: 0.6,
  mvps: 2,
  oneV1Count: 0,
  oneV1Wins: 0,
  oneV2Count: 0,
  oneV2Wins: 0,
  pentaKills: 0,
  pistolKills: 1,
  quadroKills: 0,
  result: true,
  sniperKills: 0,
  tripleKills: 0,
  utilityDamage: 50,
  ...overrides,
});

const match: PlayerHistoryMatch = {
  ...makePlayer({ playerId: "p1", nickname: "Alice", kills: 22 }),
  matchId: "match-1",
  map: "de_inferno",
  score: "13-8",
  startedAt: 1,
  finishedAt: 2,
  queueBucket: "party",
  knownQueuedFriendCount: 2,
  knownQueuedFriendIds: ["p2", "p3"],
  partySize: 3,
};

describe("MatchAccordion rivalry receipts", () => {
  it("renders a compact rivalry strip for an opened match", () => {
    const html = renderToStaticMarkup(
      <MatchAccordion
        demoMatches={{}}
        eloMap={{ p1: 2000, p2: 1800, p3: 1700 }}
        initialOpenMatchId="match-1"
        matches={[match]}
        matchStats={{
          "match-1": [
            makePlayer({
              playerId: "p1",
              nickname: "Alice",
              kills: 28,
              adr: 102,
              result: true,
            }),
            makePlayer({
              playerId: "p2",
              nickname: "Bob",
              kills: 16,
              adr: 71,
              result: true,
            }),
            makePlayer({
              playerId: "p3",
              nickname: "Cara",
              kills: 20,
              adr: 88,
              result: true,
            }),
          ],
        }}
        partyMemberIds={["p1", "p2", "p3"]}
      />
    );

    expect(html).toContain("Rivalry receipt");
    expect(html).toContain("Best");
    expect(html).toContain("Alice");
    expect(html).toContain("Weakest");
    expect(html).toContain("Bob");
    expect(html).toContain("Swing");
  });
});
