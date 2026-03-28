import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BetHistoryTab } from "~/components/BetHistoryTab";
import { BetsLeaderboardTab } from "~/components/BetsLeaderboardTab";
import { PageSectionTabs } from "~/components/PageSectionTabs";

type BetsTab = "my-bets" | "leaderboard";

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

export const Route = createFileRoute("/_authed/bets")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "leaderboard" ? "leaderboard" : ("my-bets" as BetsTab),
  }),
  component: BetsPage,
});

function BetsPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getClientSession().then((session) => {
      setIsSignedIn(!!session);
      setUserId(session?.user.id ?? null);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (authResolved && !isSignedIn) {
      navigate({ to: "/sign-in", replace: true });
    }
  }, [authResolved, isSignedIn, navigate]);

  const sectionTabs = [
    { key: "my-bets", label: "My Bets" },
    { key: "leaderboard", label: "Leaderboard" },
  ];

  if (!authResolved) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-accent text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          <PageSectionTabs
            activeKey={tab}
            onChange={(next) =>
              navigate({
                to: "/bets",
                search: { tab: next as BetsTab },
                replace: true,
              })
            }
            tabs={sectionTabs}
          />

          {tab === "my-bets" ? (
            <BetHistoryTab userId={userId} />
          ) : (
            <BetsLeaderboardTab userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
