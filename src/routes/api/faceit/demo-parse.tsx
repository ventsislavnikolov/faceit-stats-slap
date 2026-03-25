import { createFileRoute } from "@tanstack/react-router";
import { createServerSupabase } from "~/lib/supabase.server";
import { queueFaceitDemoParse } from "~/server/demo-ingestion";

export const Route = createFileRoute("/api/faceit/demo-parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { matchId?: string; demoUrl?: string | null };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const matchId = body.matchId?.trim();
        if (!matchId) {
          return Response.json({ error: "Missing matchId" }, { status: 400 });
        }

        try {
          const supabase = createServerSupabase();
          const result = await queueFaceitDemoParse(supabase, {
            faceitMatchId: matchId,
            demoUrl: body.demoUrl ?? null,
          });

          return Response.json(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
