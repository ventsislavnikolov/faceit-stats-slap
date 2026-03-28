import {
  createFileRoute,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CoinBalance } from "~/components/CoinBalance";
import { initializeAuthSession } from "~/lib/auth";
import { getPlayerViewHref } from "~/lib/player-view-shell";

const subscribeToAuthSession = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(
    async (onSession: (session: { user: { id: string } } | null) => void) => {
      const { getSupabaseClient } = await import("~/lib/supabase.client");
      const cleanup = await initializeAuthSession(
        getSupabaseClient(),
        onSession
      );
      return { unsubscribe: cleanup };
    }
  );

const doSignOut = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    await getSupabaseClient().auth.signOut();
  });

export const Route = createFileRoute("/_authed")({
  component: AppLayout,
});

function getCurrentNickname(
  pathname: string,
  search: Record<string, unknown>
): string | null {
  if (
    pathname === "/history" ||
    pathname === "/leaderboard" ||
    pathname === "/last-party"
  ) {
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
  const friendsHref = currentNickname
    ? getPlayerViewHref("friends", currentNickname)
    : { to: "/" };
  const historyHref = currentNickname
    ? getPlayerViewHref("history", currentNickname)
    : {
        to: "/history",
        search: { player: undefined, matches: 20, queue: "party" },
      };
  const leaderboardHref = currentNickname
    ? getPlayerViewHref("leaderboard", currentNickname)
    : { to: "/leaderboard", search: { player: undefined } };
  const lastPartyHref = currentNickname
    ? getPlayerViewHref("last-party", currentNickname)
    : { to: "/last-party", search: { player: undefined } };
  const betsHref = { to: "/bets", search: { tab: "my-bets" } };
  const pathSegments = pathname.split("/").filter(Boolean);
  const isFriendsActive =
    pathSegments.length === 1 &&
    pathname !== "/history" &&
    pathname !== "/leaderboard" &&
    pathname !== "/last-party" &&
    pathname !== "/sign-in";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileNavLink =
    "block px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent";
  const mobileNavLinkActive = `${mobileNavLink} text-accent`;
  const mobileNavLinkInactive = `${mobileNavLink} text-text-muted`;
  const desktopNavLinkActive = "text-accent";
  const desktopNavLinkInactive = "text-text-muted hover:text-accent";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className="flex h-screen flex-col">
      <nav className="relative flex items-center justify-between border-border border-b bg-bg-card px-4 py-2.5">
        {/* Mobile hamburger */}
        <div className="flex items-center gap-3 lg:hidden" ref={menuRef}>
          <button
            aria-expanded={menuOpen}
            aria-label="Open menu"
            className="flex flex-col justify-center gap-[5px] p-1 hover:opacity-80"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className="block h-[2px] w-5 bg-text" />
            <span className="block h-[2px] w-5 bg-text" />
            <span className="block h-[2px] w-5 bg-text" />
          </button>
          <Link
            className="font-bold text-accent text-base hover:opacity-80"
            to="/"
          >
            FACEIT Stats <span className="text-text">Slap</span>
          </Link>

          {menuOpen && (
            <div className="absolute top-full left-0 z-50 mt-px min-w-48 border border-border bg-bg-card shadow-lg">
              <div className="flex flex-col py-1">
                <Link
                  className={
                    isFriendsActive
                      ? mobileNavLinkActive
                      : mobileNavLinkInactive
                  }
                  onClick={() => setMenuOpen(false)}
                  params={friendsHref.params as never}
                  search={friendsHref.search as never}
                  to={friendsHref.to as never}
                >
                  Friends
                </Link>
                <Link
                  activeProps={{ className: mobileNavLinkActive }}
                  inactiveProps={{ className: mobileNavLinkInactive }}
                  onClick={() => setMenuOpen(false)}
                  params={lastPartyHref.params as never}
                  search={lastPartyHref.search as never}
                  to={lastPartyHref.to as never}
                >
                  Last Party
                </Link>
                <Link
                  activeProps={{ className: mobileNavLinkActive }}
                  inactiveProps={{ className: mobileNavLinkInactive }}
                  onClick={() => setMenuOpen(false)}
                  params={leaderboardHref.params as never}
                  search={leaderboardHref.search as never}
                  to={leaderboardHref.to as never}
                >
                  Leaderboard
                </Link>
                {isSignedIn && (
                  <Link
                    activeProps={{ className: mobileNavLinkActive }}
                    inactiveProps={{ className: mobileNavLinkInactive }}
                    onClick={() => setMenuOpen(false)}
                    search={betsHref.search as never}
                    to={betsHref.to as never}
                  >
                    Bets
                  </Link>
                )}
                <Link
                  activeProps={{ className: mobileNavLinkActive }}
                  inactiveProps={{ className: mobileNavLinkInactive }}
                  onClick={() => setMenuOpen(false)}
                  params={historyHref.params as never}
                  search={historyHref.search as never}
                  to={historyHref.to as never}
                >
                  History
                </Link>

                <div className="my-1 border-border border-t" />

                {isSignedIn ? (
                  <>
                    {userId && (
                      <div className="px-3 py-2">
                        <CoinBalance userId={userId} />
                      </div>
                    )}
                    <button
                      className="px-3 py-2 text-left text-text-muted text-xs hover:bg-error/10 hover:text-error"
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    className="px-3 py-2 text-accent text-xs hover:bg-accent/10"
                    onClick={() => setMenuOpen(false)}
                    to="/sign-in"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            className="font-bold text-accent text-base hover:opacity-80"
            to="/"
          >
            FACEIT Stats <span className="text-text">Slap</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link
              className={
                isFriendsActive ? desktopNavLinkActive : desktopNavLinkInactive
              }
              params={friendsHref.params as never}
              search={friendsHref.search as never}
              to={friendsHref.to as never}
            >
              Friends
            </Link>
            <Link
              activeProps={{ className: desktopNavLinkActive }}
              inactiveProps={{ className: desktopNavLinkInactive }}
              params={lastPartyHref.params as never}
              search={lastPartyHref.search as never}
              to={lastPartyHref.to as never}
            >
              Last Party
            </Link>
            <Link
              activeProps={{ className: desktopNavLinkActive }}
              inactiveProps={{ className: desktopNavLinkInactive }}
              params={leaderboardHref.params as never}
              search={leaderboardHref.search as never}
              to={leaderboardHref.to as never}
            >
              Leaderboard
            </Link>
            {isSignedIn && (
              <Link
                activeProps={{ className: desktopNavLinkActive }}
                inactiveProps={{ className: desktopNavLinkInactive }}
                search={betsHref.search as never}
                to={betsHref.to as never}
              >
                Bets
              </Link>
            )}
            <Link
              activeProps={{ className: desktopNavLinkActive }}
              inactiveProps={{ className: desktopNavLinkInactive }}
              params={historyHref.params as never}
              search={historyHref.search as never}
              to={historyHref.to as never}
            >
              History
            </Link>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {isSignedIn ? (
            <>
              {userId && <CoinBalance userId={userId} />}
              <button
                className="text-text-muted text-xs hover:text-error"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              className="rounded border border-accent/40 px-3 py-1 text-accent text-xs hover:bg-accent/10"
              to="/sign-in"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
