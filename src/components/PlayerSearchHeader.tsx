import type { ReactNode } from "react";

interface PlayerSearchHeaderProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  placeholder: string;
  isSearching?: boolean;
  layout?: "contained" | "full";
  status?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
}

export function PlayerSearchHeader({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  isSearching = false,
  layout = "contained",
  status,
  error,
  children,
}: PlayerSearchHeaderProps) {
  return (
    <div className="border-b border-border bg-bg-card">
      <div className={layout === "full" ? "px-4 py-3" : "mx-auto max-w-6xl px-4 py-3"}>
        <form onSubmit={onSubmit} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded bg-accent px-4 py-1.5 text-sm font-bold text-bg hover:opacity-90 disabled:opacity-50"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </form>

        {status && (
          <div className="mt-1.5 text-xs text-text-muted">
            {status}
          </div>
        )}

        {error && (
          <div className="mt-1.5 text-xs text-error">
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
