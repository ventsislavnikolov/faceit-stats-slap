import type { SessionRivalryCard } from "~/lib/types";

interface SessionRivalryCardsProps {
  cards: SessionRivalryCard[];
}

export function SessionRivalryCards({ cards }: SessionRivalryCardsProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
        Session Rivalries
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {cards.map((card) => (
          <div
            className="rounded border border-border bg-bg-card p-3"
            key={card.id}
          >
            <div className="text-[10px] text-text-dim uppercase tracking-wider">
              {card.title}
            </div>
            <div className="mt-1 font-bold text-sm text-text">
              {card.summary}
            </div>
            {card.evidence.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.evidence.map((line) => (
                  <span
                    className="rounded border border-border bg-bg-elevated px-2 py-0.5 text-[10px] text-text-dim"
                    key={line}
                  >
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
