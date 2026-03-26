import type { SessionAward } from "~/lib/types";

interface PartyAwardsProps {
  awards: SessionAward[];
}

const AWARD_ICONS: Record<string, string> = {
  "party-mvp": "\u{1F451}",
  "party-anchor": "\u{1F480}",
  "headshot-machine": "\u{1F3AF}",
  "damage-dealer": "\u{1F4A5}",
  "map-specialist": "\u{1F5FA}",
  "entry-king": "\u{1F6AA}",
  "utility-lord": "\u{1F4A3}",
  "trade-master": "\u{1F91D}",
  "clutch-god": "\u{26A1}",
  "flash-demon": "\u{2728}",
  "economy-king": "\u{1F4B0}",
};

export function PartyAwards({ awards }: PartyAwardsProps) {
  if (awards.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Awards
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {awards.map((award) => (
          <div
            className={`rounded border border-border bg-bg-card p-3 ${
              award.id === "party-mvp"
                ? "border-accent/30 bg-accent/5"
                : award.id === "party-anchor"
                  ? "border-error/20 bg-error/5"
                  : ""
            }`}
            key={award.id}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">
                {AWARD_ICONS[award.id] ?? "\u{1F3C6}"}
              </span>
              <div>
                <div className="text-[10px] text-text-dim uppercase">
                  {award.title}
                </div>
                <div className="font-bold text-sm text-text">
                  {award.recipient}
                </div>
                <div className="text-[11px] text-text-muted">{award.value}</div>
              </div>
            </div>
            {award.banter && (
              <div className="mt-2 text-[10px] text-text-muted italic">
                {award.banter}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
