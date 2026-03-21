import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
  component: AppLayout,
});

function AppLayout() {
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
      </nav>
      <Outlet />
    </div>
  );
}
