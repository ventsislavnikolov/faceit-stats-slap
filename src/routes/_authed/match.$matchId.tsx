import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMatchDetails } from "~/server/matches";
import { MapBadge } from "~/components/MapBadge";
import type { MatchPlayerStats, MatchDetail } from "~/lib/types";

const requireAuth = createIsomorphicFn()
  .server(() => {})
  .client(async () => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) throw redirect({ to: "/sign-in" as any });
  });

export const Route = createFileRoute("/_authed/match/$matchId")({
  beforeLoad: () => requireAuth(),
  component: MatchDetailPage,
});

type StatCol = {
  key: keyof MatchPlayerStats;
  label: string;
  format?: (v: number) => string;
};

const STAT_COLS: StatCol[] = [
  { key: "kills", label: "K" },
  { key: "deaths", label: "D" },
  { key: "assists", label: "A" },
  { key: "kdRatio", label: "K/D", format: (v) => v.toFixed(2) },
  { key: "adr", label: "ADR", format: (v) => v.toFixed(1) },
  { key: "hsPercent", label: "HS%", format: (v) => `${v}%` },
  { key: "krRatio", label: "K/R", format: (v) => v.toFixed(2) },
  { key: "firstKills", label: "FK" },
  { key: "clutchKills", label: "CK" },
  { key: "damage", label: "DMG" },
  { key: "mvps", label: "MVP" },
];

function TeamScoreboard({
  teamName,
  score,
  players,
  playerIds,
  isWinner,
}: {
  teamName: string;
  score: number;
  players: MatchPlayerStats[];
  playerIds: string[];
  isWinner: boolean;
}) {
  const teamPlayers = playerIds
    .map((id) => players.find((p) => p.playerId === id))
    .filter(Boolean) as MatchPlayerStats[];

  const sorted = [...teamPlayers].sort((a, b) => b.kills - a.kills);

  const gridCols = `2rem 1fr repeat(${STAT_COLS.length}, minmax(2.5rem, 3.5rem))`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`font-bold text-sm ${isWinner ? "text-accent" : "text-error"}`}>
          {isWinner ? "W" : "L"}
        </span>
        <span className="text-text font-bold text-sm">{teamName}</span>
        <span className="text-text-dim text-xs">({score})</span>
      </div>

      <div
        className="grid gap-1 px-3 pb-1 text-[10px] text-text-dim uppercase tracking-wider"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span>#</span>
        <span>Player</span>
        {STAT_COLS.map((col) => (
          <span key={col.key} className="text-right">{col.label}</span>
        ))}
      </div>

      {sorted.map((p, i) => (
        <div
          key={p.playerId}
          className="grid gap-1 items-center px-3 py-1.5 rounded text-xs bg-bg-elevated"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="text-text-dim text-[10px]">{i + 1}</span>
          <span className="font-bold text-text truncate">{p.nickname}</span>
          {STAT_COLS.map((col) => {
            const val = p[col.key] as number;
            return (
              <span key={col.key} className="text-right text-text-muted">
                {col.format ? col.format(val) : val}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MatchDetailPage() {
  const { matchId } = Route.useParams();

  const { data: match, isLoading, isError } = useQuery<MatchDetail>({
    queryKey: ["match-detail", matchId],
    queryFn: () => getMatchDetails({ data: matchId }),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-accent animate-pulse text-sm">Loading match...</span>
      </div>
    );
  }

  if (isError || !match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-error text-sm">Match not found</span>
      </div>
    );
  }

  const f1Won = match.teams.faction1.score > match.teams.faction2.score;

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto w-full overflow-y-auto">
      <Link
        to="/history"
        search={{ player: undefined }}
        className="text-text-muted text-xs hover:text-accent mb-4 inline-block"
      >
        &larr; Back
      </Link>

      {/* Match header */}
      <div className="flex items-center gap-4 mb-6">
        <MapBadge map={match.map} />
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{match.score}</span>
          </div>
          <div className="text-text-dim text-xs">
            {match.competitionName}
            {match.rounds > 0 && ` · ${match.rounds} rounds`}
            {match.region && ` · ${match.region}`}
          </div>
          {match.finishedAt && (
            <div className="text-text-dim text-[10px] mt-0.5">
              {new Date(match.finishedAt * 1000).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scoreboards */}
      <div className="flex flex-col gap-6">
        <TeamScoreboard
          teamName={match.teams.faction1.name}
          score={match.teams.faction1.score}
          players={match.players}
          playerIds={match.teams.faction1.playerIds}
          isWinner={f1Won}
        />
        <TeamScoreboard
          teamName={match.teams.faction2.name}
          score={match.teams.faction2.score}
          players={match.players}
          playerIds={match.teams.faction2.playerIds}
          isWinner={!f1Won}
        />
      </div>

      {/* RWS section placeholder */}
      <div className="mt-8 p-4 rounded bg-bg-elevated border border-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-text">RWS (Round Win Share)</span>
            <p className="text-text-dim text-xs mt-1">
              Requires demo file parsing. Coming soon.
            </p>
          </div>
          <button
            disabled
            className="text-xs px-4 py-2 rounded bg-bg-card text-text-dim cursor-not-allowed"
          >
            Calculate RWS
          </button>
        </div>
      </div>

      {/* FACEIT link */}
      <div className="mt-4 text-center">
        <a
          href={`https://www.faceit.com/en/cs2/room/${matchId}/scoreboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted text-xs hover:text-accent"
        >
          View on FACEIT
        </a>
      </div>
    </div>
  );
}
