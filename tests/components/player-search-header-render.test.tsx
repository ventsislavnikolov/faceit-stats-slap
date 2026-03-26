import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";

const defaultProps = {
  onSubmit: vi.fn(),
  onValueChange: vi.fn(),
  placeholder: "Search players...",
  value: "alice",
};

describe("PlayerSearchHeader rendering", () => {
  it("renders input with placeholder and value", () => {
    const html = renderToStaticMarkup(<PlayerSearchHeader {...defaultProps} />);

    expect(html).toContain('placeholder="Search players..."');
    expect(html).toContain('value="alice"');
    expect(html).toContain('type="text"');
  });

  it("shows Search button by default", () => {
    const html = renderToStaticMarkup(<PlayerSearchHeader {...defaultProps} />);

    expect(html).toContain(">Search</button>");
  });

  it('shows "..." when isSearching', () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader {...defaultProps} isSearching={true} />
    );

    expect(html).toContain("...");
    expect(html).toContain("disabled");
  });

  it("renders status message when provided", () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader {...defaultProps} status="3 results found" />
    );

    expect(html).toContain("3 results found");
    expect(html).toContain("text-text-muted");
  });

  it("renders error message when provided", () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader {...defaultProps} error="Player not found" />
    );

    expect(html).toContain("Player not found");
    expect(html).toContain("text-error");
  });

  it("renders children", () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader {...defaultProps}>
        <div>Custom content</div>
      </PlayerSearchHeader>
    );

    expect(html).toContain("Custom content");
  });

  it("uses contained layout by default", () => {
    const html = renderToStaticMarkup(<PlayerSearchHeader {...defaultProps} />);

    expect(html).toContain("mx-auto max-w-6xl px-4 py-3");
  });

  it('uses full layout class when layout="full"', () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader {...defaultProps} layout="full" />
    );

    expect(html).toContain("px-4 py-3");
    expect(html).not.toContain("mx-auto max-w-6xl");
  });

  it("does not render status or error sections when not provided", () => {
    const html = renderToStaticMarkup(<PlayerSearchHeader {...defaultProps} />);

    expect(html).not.toContain("text-text-muted");
    expect(html).not.toContain("text-error");
  });
});
