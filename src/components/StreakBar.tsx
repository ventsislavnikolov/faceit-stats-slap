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
          key={i}
          className={`w-3.5 h-1.5 rounded-sm ${win ? "bg-accent" : "bg-error"}`}
        />
      ))}
      <span className="text-text-dim text-[10px] ml-1">
        {wins}W {losses}L
      </span>
    </div>
  );
}
