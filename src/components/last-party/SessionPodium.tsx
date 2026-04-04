import type { SessionPodiumEntry } from "~/lib/types";

interface SessionPodiumProps {
  entries: SessionPodiumEntry[];
}

const BADGE_STYLES: Record<string, string> = {
  Carry: "border-accent/30 bg-accent/10 text-accent",
  Closer: "border-border bg-bg-elevated text-text",
  Stabilizer: "border-border bg-bg-elevated text-text",
  "Entry King": "border-error/30 bg-error/10 text-error",
  Balanced: "border-border bg-bg-elevated text-text-dim",
  "Fraud Watch": "border-error/30 bg-error/10 text-error",
};

export function SessionPodium({ entries }: SessionPodiumProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Podium
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {entries.slice(0, 3).map((entry) => (
          <div
            className={`rounded border bg-bg-card p-3 ${
              entry.rank === 1
                ? "border-accent/30 bg-accent/5"
                : entry.rank === 2
                  ? "border-border"
                  : "border-border/80 bg-bg-elevated"
            }`}
            key={entry.faceitId}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-elevated font-bold text-sm text-text">
                  {entry.rank}
                </div>
                <div>
                  <div className="text-[10px] text-text-dim uppercase tracking-wider">
                    {entry.badge}
                  </div>
                  <div className="font-bold text-sm text-text">
                    {entry.nickname}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-accent text-lg">
                  {entry.sessionScore.toFixed(1)}
                </div>
                <div className="text-[10px] text-text-dim uppercase tracking-wider">
                  Score
                </div>
              </div>
            </div>
            <div
              className={`mt-3 rounded border px-2 py-1 text-[11px] ${
                BADGE_STYLES[entry.badge] ??
                "border-border bg-bg-elevated text-text-dim"
              }`}
            >
              {entry.verdict}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
