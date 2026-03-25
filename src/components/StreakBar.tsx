interface StreakBarProps {
  results: boolean[];
}

export function StreakBar({ results }: StreakBarProps) {
  const wins = results.filter(Boolean).length;
  const losses = results.length - wins;
  return (
    <div className="flex items-center gap-1">
      {results.map((win, i) => (
        <span
          className={`h-1.5 w-3.5 rounded-sm ${win ? "bg-accent" : "bg-error"}`}
          key={i}
        />
      ))}
      <span className="ml-1 text-[10px] text-text-dim">
        {wins}W {losses}L
      </span>
    </div>
  );
}
