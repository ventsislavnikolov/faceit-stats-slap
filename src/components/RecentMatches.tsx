import { MatchRow } from "./MatchRow";

interface RecentMatch {
  nickname: string;
  matchId: string;
  map: string;
  score: string;
  kdRatio: number;
  adr: number;
  hsPercent: number;
  result: boolean;
  eloDelta?: number | null;
}

interface RecentMatchesProps {
  matches: RecentMatch[];
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  if (!matches.length) {
    return (
      <div className="text-text-dim text-sm text-center py-8">No recent matches</div>
    );
  }

  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">
        Recent Matches
      </div>
      <div className="flex flex-col gap-1">
        {matches.map((m) => (
          <MatchRow key={m.matchId + m.nickname} {...m} win={m.result} />
        ))}
      </div>
    </div>
  );
}
