import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CreateSeasonForm } from "~/components/CreateSeasonForm";
import { LiveBetsTab } from "~/components/LiveBetsTab";
import { PageSectionTabs } from "~/components/PageSectionTabs";
import { SeasonHeader } from "~/components/SeasonHeader";
import { SeasonHistoryTab } from "~/components/SeasonHistoryTab";
import { SeasonLeaderboardTab } from "~/components/SeasonLeaderboardTab";
import { SeasonMyBetsTab } from "~/components/SeasonMyBetsTab";
import { useActiveSeason } from "~/hooks/useActiveSeason";
import { useLiveMatches } from "~/hooks/useLiveMatches";
import { useSeasonCoinBalance } from "~/hooks/useSeasonCoinBalance";
import { MY_NICKNAME } from "~/lib/constants";
import { getTrackedWebhookPlayerIds } from "~/lib/faceit-webhooks";

type BetsTab = "leaderboard" | "live" | "my-bets" | "history";

const VALID_TABS: BetsTab[] = ["leaderboard", "live", "my-bets", "history"];

const getClientSession = createIsomorphicFn()
  .server(() => null)
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    return session;
  });

const getProfileNickname = createIsomorphicFn()
  .server(() => null)
  .client(async (userId: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data } = await getSupabaseClient()
      .from("profiles")
      .select("nickname")
      .eq("id", userId)
      .single();
    return (data as { nickname: string } | null)?.nickname ?? null;
  });

export const Route = createFileRoute("/_authed/bets")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: VALID_TABS.includes(search.tab as BetsTab)
      ? (search.tab as BetsTab)
      : ("leaderboard" as BetsTab),
  }),
  component: BetsPage,
});

const SECTION_TABS = [
  { key: "leaderboard", label: "Leaderboard" },
  { key: "live", label: "Live Bets" },
  { key: "my-bets", label: "My Bets" },
  { key: "history", label: "History" },
];

function BetsPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getClientSession().then(async (session) => {
      setIsSignedIn(!!session);
      setUserId(session?.user.id ?? null);
      setAuthResolved(true);

      if (session?.user.id) {
        const nickname = await getProfileNickname(session.user.id);
        setIsAdmin(nickname === MY_NICKNAME);
      }
    });
  }, []);

  useEffect(() => {
    if (authResolved && !isSignedIn) {
      navigate({ to: "/sign-in", replace: true });
    }
  }, [authResolved, isSignedIn, navigate]);

  const { data: season, isLoading: seasonLoading } = useActiveSeason();
  const { data: coinBalance } = useSeasonCoinBalance(
    season?.id ?? null,
    userId
  );
  const userCoins = coinBalance ?? 0;

  const trackedPlayerIds = getTrackedWebhookPlayerIds();
  const { data: liveMatches = [] } = useLiveMatches(trackedPlayerIds);

  if (!authResolved || seasonLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-accent text-sm">Loading...</div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
            <div className="py-8 text-center text-sm text-text-dim">
              No active season.
            </div>
            <SeasonHistoryTab userId={userId} />
            {isAdmin && userId && <CreateSeasonForm userId={userId} />}
          </div>
        </div>
      </div>
    );
  }

  if (season.status === "upcoming") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
            <SeasonHeader season={season} userCoins={null} />
            <div className="py-12 text-center text-sm text-text-dim">
              Season starts soon.
            </div>
          </div>
        </div>
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
          <SeasonHeader season={season} userCoins={userCoins} />

          <PageSectionTabs
            activeKey={tab}
            onChange={(next) =>
              navigate({
                to: "/bets",
                search: { tab: next as BetsTab },
                replace: true,
              })
            }
            tabs={SECTION_TABS}
          />

          {tab === "leaderboard" && (
            <SeasonLeaderboardTab season={season} userId={userId} />
          )}
          {tab === "live" && (
            <LiveBetsTab
              liveMatches={liveMatches}
              seasonId={season.id}
              userCoins={userCoins}
              userId={userId}
            />
          )}
          {tab === "my-bets" && (
            <SeasonMyBetsTab seasonId={season.id} userId={userId} />
          )}
          {tab === "history" && <SeasonHistoryTab userId={userId} />}
        </div>
      </div>
    </div>
  );
}
