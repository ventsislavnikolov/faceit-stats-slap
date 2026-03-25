import { MatchRow } from "./MatchRow";

interface RecentMatch {
  adr: number;
  eloDelta?: number | null;
  hsPercent: number;
  kdRatio: number;
  map: string;
  matchId: string;
  nickname: string;
  queueBucket?: "solo" | "party" | "unknown";
  result: boolean;
  score: string;
}

interface RecentMatchesProps {
  matches: RecentMatch[];
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  if (!matches.length) {
    return (
      <div className="py-8 text-center text-sm text-text-dim">
        No recent matches
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-[11px] text-text-muted uppercase tracking-wider">
        Recent Matches
      </div>
      <div className="flex flex-col gap-1">
        {matches.map((m) => (
          <MatchRow
            key={m.matchId + m.nickname}
            {...m}
            matchId={m.matchId}
            win={m.result}
          />
        ))}
      </div>
    </div>
  );
}
