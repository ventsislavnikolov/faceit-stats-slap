import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "~/components/AppLayout";

export const Route = createFileRoute("/_authed")({
  component: AppLayout,
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-text-muted">
      404 — Page not found
    </div>
  ),
});
