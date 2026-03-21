import { createFileRoute, Outlet, Link, redirect, useRouter } from "@tanstack/react-router";
import { getSupabaseClient } from "~/lib/supabase.client";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
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
