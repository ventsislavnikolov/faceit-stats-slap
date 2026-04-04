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
import type { Season } from "~/lib/types";

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

function UpcomingSeasonCountdown({ season }: { season: Season }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(season.startsAt).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      if (diff === 0) {
        setTimeLeft("Starting...");
        return;
      }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      const parts: string[] = [];
      if (days > 0) {
        parts.push(`${days}d`);
      }
      if (hours > 0) {
        parts.push(`${hours}h`);
      }
      if (mins > 0) {
        parts.push(`${mins}m`);
      }
      parts.push(`${secs}s`);
      setTimeLeft(parts.join(" "));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [season.startsAt]);

  const prize = season.prizes[0];

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-sm text-text-dim uppercase tracking-wider">
        Season starts in
      </div>
      <div className="font-bold font-mono text-4xl text-accent">{timeLeft}</div>

      {prize?.imageUrl && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 p-6">
          <img
            alt={prize.skinName ?? prize.description}
            className="h-36 object-contain drop-shadow-[0_0_12px_rgba(80,250,123,0.3)]"
            height={144}
            src={prize.imageUrl}
            width={144}
          />
          <div className="text-center">
            <div className="font-bold text-text">
              {prize.skinName ?? prize.description}
            </div>
            {prize.wear && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent text-xs">
                {prize.wear}
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-dim uppercase tracking-wider">
            1st Place Prize
          </div>
        </div>
      )}

      {!prize?.imageUrl && prize && (
        <div className="text-sm text-text-muted">
          Prize: {prize.skinName ?? prize.description}
        </div>
      )}

      <div className="text-text-dim text-xs">
        Everyone starts with 1,000 coins. Go broke = sit out.
      </div>
    </div>
  );
}

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
      navigate({
        to: "/sign-in",
        search: { redirect: "/bets" },
        replace: true,
      });
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
            {/* Season header skeleton */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-32 animate-pulse rounded bg-border" />
                <div className="h-4 w-24 animate-pulse rounded bg-border" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-border" />
            </div>
            {/* Tab bar skeleton */}
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  className="h-8 w-24 animate-pulse rounded bg-bg-elevated"
                  key={i}
                />
              ))}
            </div>
            {/* Leaderboard rows skeleton */}
            <div className="flex flex-col gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  className="grid gap-2 rounded bg-bg-elevated px-3 py-2"
                  key={i}
                  style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem 5rem" }}
                >
                  <div className="h-3 w-6 animate-pulse rounded bg-border" />
                  <div className="h-3 w-24 animate-pulse rounded bg-border" />
                  <div className="ml-auto h-3 w-10 animate-pulse rounded bg-border" />
                  <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
                  <div className="ml-auto h-3 w-8 animate-pulse rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
        </div>
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
            <UpcomingSeasonCountdown season={season} />
            <SeasonHistoryTab userId={userId} />
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
