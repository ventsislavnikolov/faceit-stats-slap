import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-accent text-2xl font-bold">Leaderboard</h1>
      <p className="text-text-muted">Coming in Phase 2 — Betting System</p>
    </div>
  );
}
