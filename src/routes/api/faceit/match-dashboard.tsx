import { createFileRoute } from "@tanstack/react-router";
import { buildMatchDashboardData } from "~/server/match-dashboard";

export const Route = createFileRoute("/api/faceit/match-dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const matchId = url.searchParams.get("matchId")?.trim();

        if (!matchId) {
          return Response.json({ error: "Missing matchId" }, { status: 400 });
        }

        try {
          const payload = await buildMatchDashboardData(matchId);
          return Response.json(payload);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown match dashboard error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
