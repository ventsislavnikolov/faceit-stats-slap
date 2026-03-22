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
    if (!target.value) return;

    if (target.kind === "match") {
      navigate({ to: "/match/$matchId", params: { matchId: target.value } });
      return;
    }

    navigate({ to: "/$nickname", params: { nickname: target.value } });
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <div className="text-center">
        <p className="text-text-muted text-sm">
          Enter a FACEIT nickname or match ID to open the live dashboard
        </p>
        <p className="text-text-dim text-xs mt-1">
          e.g. <span className="text-accent">faceit-friends-live.vercel.app/soavarice</span>
        </p>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-sm">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="FACEIT nickname, player UUID, or match ID..."
          autoFocus
          className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text focus:border-accent outline-none"
        />
        <button
          type="submit"
          className="bg-accent text-bg text-sm font-bold px-4 py-2 rounded hover:opacity-90"
        >
          Search
        </button>
      </form>
    </div>
  );
}
