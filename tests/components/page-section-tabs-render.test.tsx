import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageSectionTabs } from "~/components/PageSectionTabs";

const tabs = [
  { key: "stats", label: "Stats" },
  { key: "bets", label: "Bets" },
  { key: "history", label: "History" },
];

describe("PageSectionTabs rendering", () => {
  it("renders all tab labels", () => {
    const html = renderToStaticMarkup(
      <PageSectionTabs activeKey="stats" onChange={() => {}} tabs={tabs} />
    );

    expect(html).toContain("Stats");
    expect(html).toContain("Bets");
    expect(html).toContain("History");
  });

  it("renders all tabs as button elements", () => {
    const html = renderToStaticMarkup(
      <PageSectionTabs activeKey="stats" onChange={() => {}} tabs={tabs} />
    );

    const buttonCount = (html.match(/<button/g) || []).length;
    expect(buttonCount).toBe(3);
  });

  it("active tab has accent styling", () => {
    const html = renderToStaticMarkup(
      <PageSectionTabs activeKey="bets" onChange={() => {}} tabs={tabs} />
    );

    expect(html).toContain("bg-accent text-bg");

    const accentIdx = html.indexOf("bg-accent text-bg");
    const betsIdx = html.indexOf("Bets");
    const statsIdx = html.indexOf("Stats");

    // Accent class appears before "Bets" label (active tab)
    expect(accentIdx).toBeLessThan(betsIdx);
    // Stats appears before the accent class (inactive, rendered first)
    expect(statsIdx).toBeLessThan(accentIdx);
  });

  it("inactive tabs have elevated styling", () => {
    const html = renderToStaticMarkup(
      <PageSectionTabs activeKey="stats" onChange={() => {}} tabs={tabs} />
    );

    expect(html).toContain("bg-bg-elevated text-text-muted");
  });

  it("applies custom className", () => {
    const html = renderToStaticMarkup(
      <PageSectionTabs
        activeKey="stats"
        className="mt-4"
        onChange={() => {}}
        tabs={tabs}
      />
    );

    expect(html).toContain("flex flex-wrap gap-1 mt-4");
  });
});
