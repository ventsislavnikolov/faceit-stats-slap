/// <reference types="vite/client" />

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useState } from "react";
import "~/styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title:
          "Faceit Friends Tracker — CS2 stats, demo analytics & live match tracking for your FACEIT squad",
      },
      {
        name: "description",
        content:
          "Track your FACEIT friends' CS2 performance in real time. Deep demo analytics, match history, leaderboards, economy breakdowns, utility stats, and side-split insights — all in one place.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap",
      },
    ],
  }),
  component: RootLayout,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">
      404 — Page not found
    </div>
  ),
});

function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-bg font-mono text-text">
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Scripts />
        </QueryClientProvider>
      </body>
    </html>
  );
}
