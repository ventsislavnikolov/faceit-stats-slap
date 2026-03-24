import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayerSearchHeader } from "~/components/PlayerSearchHeader";

describe("PlayerSearchHeader", () => {
  it("uses the contained layout by default", () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Search"
      />
    );

    expect(html).toContain("mx-auto max-w-6xl px-4 py-3");
  });

  it("uses a full-width layout when requested", () => {
    const html = renderToStaticMarkup(
      <PlayerSearchHeader
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Search"
        layout="full"
      />
    );

    expect(html).toContain("px-4 py-3");
    expect(html).not.toContain("mx-auto max-w-6xl px-4 py-3");
  });
});
