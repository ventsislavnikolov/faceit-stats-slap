import type { ReactNode } from "react";

interface PlayerSearchHeaderProps {
  children?: ReactNode;
  error?: ReactNode;
  isSearching?: boolean;
  layout?: "contained" | "full";
  onSubmit: (event: React.FormEvent) => void;
  onValueChange: (value: string) => void;
  placeholder: string;
  status?: ReactNode;
  value: string;
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
    <div className="border-border border-b bg-bg-card">
      <div
        className={
          layout === "full" ? "px-4 py-3" : "mx-auto max-w-6xl px-4 py-3"
        }
      >
        <form className="flex max-w-md gap-2" onSubmit={onSubmit}>
          <input
            className="flex-1 rounded border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            type="text"
            value={value}
          />
          <button
            className="rounded bg-accent px-4 py-1.5 font-bold text-bg text-sm hover:opacity-90 disabled:opacity-50"
            disabled={isSearching}
            type="submit"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </form>

        {status && (
          <div className="mt-1.5 text-text-muted text-xs">{status}</div>
        )}

        {error && <div className="mt-1.5 text-error text-xs">{error}</div>}

        {children}
      </div>
    </div>
  );
}
