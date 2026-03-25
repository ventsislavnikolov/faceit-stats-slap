import { createFileRoute } from "@tanstack/react-router";
import { persistFaceitWebhook } from "~/server/faceit-webhooks";

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const headerName = process.env.FACEIT_WEBHOOK_HEADER_NAME;
  const headerValue = process.env.FACEIT_WEBHOOK_HEADER_VALUE;
  const queryName = process.env.FACEIT_WEBHOOK_QUERY_NAME;
  const queryValue = process.env.FACEIT_WEBHOOK_QUERY_VALUE;

  const checks: boolean[] = [];

  if (headerName && headerValue) {
    checks.push(request.headers.get(headerName) === headerValue);
  }

  if (queryName && queryValue) {
    checks.push(url.searchParams.get(queryName) === queryValue);
  }

  if (checks.length === 0) {
    return true;
  }
  return checks.every(Boolean);
}

export const Route = createFileRoute("/api/faceit/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as Record<string, unknown>;
        await persistFaceitWebhook(body);

        return new Response(null, { status: 204 });
      },
    },
  },
});
