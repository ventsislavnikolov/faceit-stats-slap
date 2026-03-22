import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CoinBalance } from "~/components/CoinBalance";

const getSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session;
  });

const doSignOut = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    await getSupabaseClient().auth.signOut();
  });

export const Route = createFileRoute("/_authed")({
  component: AppLayout,
});

function AppLayout() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((s) => { setIsSignedIn(!!s); setUserId(s?.user.id ?? null); });
  }, []);

  async function handleSignOut() {
    await doSignOut();
    setIsSignedIn(false);
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex justify-between items-center px-4 py-2.5 bg-bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-accent font-bold text-base hover:opacity-80">
            FaceitFriends<span className="text-text">Live</span>
          </Link>
          <div className="flex gap-3 text-xs">
            <Link
              to="/history"
              search={{ player: undefined }}
              activeProps={{ className: "text-accent border-b border-accent pb-0.5" }}
              inactiveProps={{ className: "text-text-muted hover:text-accent" }}
            >
              History
            </Link>
            <Link
              to="/leaderboard"
              search={{ player: undefined }}
              activeProps={{ className: "text-accent border-b border-accent pb-0.5" }}
              inactiveProps={{ className: "text-text-muted hover:text-accent" }}
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {isSignedIn ? (
          <div className="flex items-center gap-3">
            {userId && <CoinBalance userId={userId} />}
            <button onClick={handleSignOut} className="text-text-muted text-xs hover:text-error">
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            to="/sign-in"
            className="text-xs text-accent border border-accent/40 px-3 py-1 rounded hover:bg-accent/10"
            // @ts-expect-error dynamic route
          >
            Sign In
          </Link>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
