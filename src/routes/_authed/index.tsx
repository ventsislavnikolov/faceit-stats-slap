import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { resolveFaceitSearchTarget } from "~/lib/faceit-search";
import { HomeLiveMatchesSection } from "~/components/HomeLiveMatchesSection";
import { useCoinBalance } from "~/hooks/useCoinBalance";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

export const Route = createFileRoute("/_authed/")({
  component: HomePage,
});

function HomePage() {
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const navigate = useNavigate();
  const { data: userCoins, isLoading: coinBalanceLoading } = useCoinBalance(userId);
  const bettingContextReady = authResolved && (!userId || !coinBalanceLoading);

  useEffect(() => {
    getClientSession().then((session) => {
      setUserId(session?.user.id ?? null);
      setAuthResolved(true);
    });
  }, []);

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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="text-center">
          <p className="text-text-muted text-sm">
            Enter a FACEIT nickname, profile link, or match ID to open the live dashboard
          </p>
          <p className="text-text-dim text-xs mt-1">
            e.g. get the nickname from{" "}
            <span className="text-accent">faceit.com/en/players/soavarice</span>
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full max-w-sm gap-2 self-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="FACEIT nickname, profile link, player UUID, or match ID..."
            autoFocus
            className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded bg-accent px-4 py-2 text-sm font-bold text-bg hover:opacity-90"
          >
            Search
          </button>
        </form>

        <HomeLiveMatchesSection
          authResolved={authResolved}
          bettingContextReady={bettingContextReady}
          userId={userId}
          userCoins={userCoins}
        />
      </div>
    </div>
  );
}
