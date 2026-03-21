import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    getSession().then((s) => setIsSignedIn(!!s));
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
          <span className="text-accent font-bold text-base">
            FaceitFriends<span className="text-text">Live</span>
          </span>
          <div className="flex gap-3 text-xs">
            <Link
              to="/"
              activeProps={{ className: "text-accent border-b border-accent pb-0.5" }}
              inactiveProps={{ className: "text-text-muted hover:text-accent" }}
            >
              Dashboard
            </Link>
            <Link
              to="/history"
              activeProps={{ className: "text-accent border-b border-accent pb-0.5" }}
              inactiveProps={{ className: "text-text-muted hover:text-accent" }}
            >
              History
            </Link>
          </div>
        </div>

        {isSignedIn ? (
          <button
            onClick={handleSignOut}
            className="text-text-muted text-xs hover:text-error"
          >
            Sign Out
          </button>
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
