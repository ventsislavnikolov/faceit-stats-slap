import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("~/server/betting", () => ({
  placeBet: vi.fn(),
}));

import { BetCard } from "~/components/BetCard";

const baseProps = {
  type: "match" as const,
  id: "pool-1",
  seasonId: "season-1",
  userId: "user-1",
  userCoins: 100,
  label: "Team Alpha vs Team Beta",
  closesAt: new Date(Date.now() + 300_000).toISOString(),
  status: "OPEN",
  side1: { label: "Team Alpha", pool: 50 },
  side2: { label: "Team Beta", pool: 30 },
};

describe("BetCard", () => {
  it("renders match bet card with both sides", () => {
    const html = renderToStaticMarkup(<BetCard {...baseProps} />);

    expect(html).toContain("Team Alpha vs Team Beta");
    expect(html).toContain("Team Alpha");
    expect(html).toContain("Team Beta");
    expect(html).toContain("50 coins");
    expect(html).toContain("30 coins");
  });

  it("renders prop bet card with YES/NO labels", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        label="Player X kills over 20.5?"
        side1={{ label: "YES", pool: 40 }}
        side2={{ label: "NO", pool: 60 }}
        sublabel="Kills threshold: 20.5"
        type="prop"
      />
    );

    expect(html).toContain("Player X kills over 20.5?");
    expect(html).toContain("Kills threshold: 20.5");
    expect(html).toContain("YES");
    expect(html).toContain("NO");
    expect(html).toContain("40 coins");
    expect(html).toContain("60 coins");
  });

  it("shows BET and ALL IN buttons when betting is open", () => {
    const html = renderToStaticMarkup(<BetCard {...baseProps} />);

    expect(html).toContain("BET");
    expect(html).toContain("ALL IN");
    expect(html).toContain("Balance: 100");
  });

  it("shows existing bet info when user already bet", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        existingBet={{ side: "team1", amount: 25, payout: null }}
      />
    );

    expect(html).toContain("Your bet");
    expect(html).toContain("25 coins on Team Alpha");
    expect(html).not.toContain("ALL IN");
  });

  it("shows win result after resolution", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        existingBet={{ side: "team1", amount: 25, payout: 50 }}
        status="RESOLVED"
        winningTeam="team1"
      />
    );

    expect(html).toContain("Won 50 coins!");
    expect(html).toContain("(+25)");
  });

  it("shows loss result after resolution", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        existingBet={{ side: "team2", amount: 25, payout: 0 }}
        status="RESOLVED"
        winningTeam="team1"
      />
    );

    expect(html).toContain("Lost this bet.");
  });

  it("shows refund message for cancelled pools", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        existingBet={{ side: "team1", amount: 25, payout: null }}
        status="REFUNDED"
      />
    );

    expect(html).toContain("Bet refunded");
  });

  it("shows closed state when pool is not open", () => {
    const html = renderToStaticMarkup(
      <BetCard
        {...baseProps}
        closesAt={new Date(Date.now() - 60_000).toISOString()}
        status="CLOSED"
      />
    );

    expect(html).toContain("Closed");
    expect(html).not.toContain("ALL IN");
    expect(html).not.toContain(">BET<");
  });

  it("disables betting when user has no coins", () => {
    const html = renderToStaticMarkup(<BetCard {...baseProps} userCoins={0} />);

    expect(html).not.toContain("ALL IN");
    expect(html).not.toContain(">BET<");
  });

  it("disables betting when user is not signed in", () => {
    const html = renderToStaticMarkup(<BetCard {...baseProps} userId={null} />);

    expect(html).not.toContain("ALL IN");
    expect(html).not.toContain(">BET<");
  });

  it("renders sublabel when provided", () => {
    const html = renderToStaticMarkup(
      <BetCard {...baseProps} sublabel="Best of 30 rounds" />
    );

    expect(html).toContain("Best of 30 rounds");
  });
});
