import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";

export const Route = createFileRoute("/_authed/")({
  component: HomePage,
});

function HomePage() {
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const target = resolveFaceitSearchTarget(input);
    if (!target.value) {
      return;
    }

    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    navigate({ to: "/$nickname", params: { nickname: target.value } });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-sm text-text-muted">
          Enter a FACEIT nickname, profile link, or match ID to open the live
          dashboard
        </p>
        <p className="mt-1 text-text-dim text-xs">
          e.g. get the nickname from{" "}
          <span className="text-accent">faceit.com/en/players/soavarice</span>
        </p>
      </div>
      <form className="flex w-full max-w-sm gap-2" onSubmit={handleSearch}>
        <input
          autoFocus
          className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
          onChange={(e) => setInput(e.target.value)}
          placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
          type="text"
          value={input}
        />
        <button
          className="rounded bg-accent px-4 py-2 font-bold text-bg text-sm hover:opacity-90"
          type="submit"
        >
          Search
        </button>
      </form>
    </div>
  );
}
