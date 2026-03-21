import { createFileRoute, Outlet, Link, redirect, useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getSupabaseClient } from "~/lib/supabase.client";

const verifyAuth = createIsomorphicFn()
  .server(() => {
    // Session lives in the browser — auth enforced client-side only
  })
  .client(async () => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  });

const doSignOut = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  });

export const Route = createFileRoute("/_authed")({
  beforeLoad: () => verifyAuth(),
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();

  async function handleSignOut() {
    await doSignOut();
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex justify-between items-center px-4 py-2.5 bg-bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-accent font-bold text-base">
            FACEIT<span className="text-text">LIVE</span>
          </span>
          <div className="flex gap-3 text-xs">
            <Link
              to="/dashboard"
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
        <button onClick={handleSignOut} className="text-text-muted text-xs hover:text-error">
          Sign Out
        </button>
      </nav>
      <Outlet />
    </div>
  );
}
