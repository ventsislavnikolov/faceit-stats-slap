import {
  createFileRoute,
  Outlet,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CoinBalance } from "~/components/CoinBalance";
import { initializeAuthSession } from "~/lib/auth";
import { getPlayerViewHref } from "~/lib/player-view-shell";

const subscribeToAuthSession = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (onSession: (session: { user: { id: string } } | null) => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const cleanup = await initializeAuthSession(getSupabaseClient(), onSession);
    return { unsubscribe: cleanup };
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

function getCurrentNickname(pathname: string, search: Record<string, unknown>): string | null {
  if (pathname === "/history" || pathname === "/leaderboard") {
    return typeof search.player === "string" && search.player.length > 0
      ? search.player
      : null;
  }

  if (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname.startsWith("/match/")
  ) {
    return null;
  }

  const nickname = pathname.slice(1);
  return nickname ? decodeURIComponent(nickname) : null;
}

export function AppLayout() {
  const router = useRouter();
  const location = useRouterState({
    select: (state) => state.location,
  });
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const pathname = location.pathname;
  const currentSearch = location.search as Record<string, unknown>;
  const currentNickname = getCurrentNickname(pathname, currentSearch);
  const friendsHref = currentNickname ? getPlayerViewHref("friends", currentNickname) : { to: "/" };
  const historyHref = currentNickname
    ? getPlayerViewHref("history", currentNickname)
    : { to: "/history", search: { player: undefined, matches: 20, queue: "party" } };
  const leaderboardHref = currentNickname
    ? getPlayerViewHref("leaderboard", currentNickname)
    : { to: "/leaderboard", search: { player: undefined } };
  const pathSegments = pathname.split("/").filter(Boolean);
  const isFriendsActive =
    pathSegments.length === 1 &&
    pathname !== "/history" &&
    pathname !== "/leaderboard" &&
    pathname !== "/sign-in";
  const navLinkBaseClass = "border-b pb-0.5";
  const navLinkActiveClass = `${navLinkBaseClass} text-accent border-accent`;
  const navLinkInactiveClass = `${navLinkBaseClass} text-text-muted border-transparent hover:text-accent`;

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    subscribeToAuthSession((session) => {
      setIsSignedIn(!!session);
      setUserId(session?.user.id ?? null);
    }).then((sub) => {
      subscription = sub;
    });

    return () => subscription?.unsubscribe();
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
              to={friendsHref.to as never}
              params={friendsHref.params as never}
              search={friendsHref.search as never}
              className={
                isFriendsActive
                  ? navLinkActiveClass
                  : navLinkInactiveClass
              }
            >
              Friends
            </Link>
            <Link
              to={leaderboardHref.to as never}
              params={leaderboardHref.params as never}
              search={leaderboardHref.search as never}
              activeProps={{ className: navLinkActiveClass }}
              inactiveProps={{ className: navLinkInactiveClass }}
            >
              Leaderboard
            </Link>
            <Link
              to={historyHref.to as never}
              params={historyHref.params as never}
              search={historyHref.search as never}
              activeProps={{ className: navLinkActiveClass }}
              inactiveProps={{ className: navLinkInactiveClass }}
            >
              History
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
