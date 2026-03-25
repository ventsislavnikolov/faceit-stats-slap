import type { DemoMatchAnalytics } from "~/lib/types";

interface DemoAnalyticsStatusPanelProps {
  demoAnalytics: DemoMatchAnalytics | null;
  demoUrl: string | null;
  isParsing?: boolean;
  matchId?: string;
  onRequestParse?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: "queued", color: "text-yellow-400" },
  parsing: { label: "parsing", color: "text-blue-400" },
  parsed: { label: "parsed", color: "text-green-400" },
  failed: { label: "failed", color: "text-red-400" },
  source_unavailable: { label: "source unavailable", color: "text-text-dim" },
};

export function DemoAnalyticsStatusPanel({
  demoAnalytics,
  demoUrl,
  matchId,
  onRequestParse,
  isParsing,
}: DemoAnalyticsStatusPanelProps) {
  // No demo URL and no analytics — nothing to show
  if (!(demoAnalytics || demoUrl)) {
    return null;
  }

  // Demo URL exists but no analytics started yet
  if (!demoAnalytics && demoUrl) {
    return (
      <div className="mb-4 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-text-dim text-xs">Demo available</span>
          <div className="flex items-center gap-2">
            {onRequestParse && (
              <button
                className="rounded bg-accent/10 px-2 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                disabled={isParsing}
                onClick={onRequestParse}
                type="button"
              >
                {isParsing ? "Queuing..." : "Parse demo"}
              </button>
            )}
            <span className="text-[10px] text-accent">Ready to parse</span>
          </div>
        </div>
      </div>
    );
  }

  if (!demoAnalytics) {
    return null;
  }

  const statusInfo = STATUS_LABELS[demoAnalytics.ingestionStatus] ?? {
    label: demoAnalytics.ingestionStatus,
    color: "text-text-dim",
  };

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-text-dim text-xs">Demo analytics</span>
        <div className="flex items-center gap-2">
          {demoAnalytics.ingestionStatus === "failed" && onRequestParse && (
            <button
              className="rounded bg-error/10 px-2 py-0.5 text-[10px] text-error transition-colors hover:bg-error/20 disabled:opacity-50"
              disabled={isParsing}
              onClick={onRequestParse}
              type="button"
            >
              Retry
            </button>
          )}
          <span className={`font-medium text-[10px] ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>
      {demoAnalytics.ingestionStatus === "parsed" && (
        <div className="mt-1 text-[10px] text-text-dim">
          {demoAnalytics.totalRounds} rounds ·{" "}
          {demoAnalytics.sourceType === "faceit_demo_url" ? "FACEIT" : "Manual"}{" "}
          source
        </div>
      )}
      {demoAnalytics.ingestionStatus === "parsing" && (
        <div className="mt-1 animate-pulse text-[10px] text-blue-400">
          Parsing demo file...
        </div>
      )}
    </div>
  );
}
