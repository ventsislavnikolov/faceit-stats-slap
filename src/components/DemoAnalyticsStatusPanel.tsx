import type { DemoMatchAnalytics } from "~/lib/types";

interface DemoAnalyticsStatusPanelProps {
  demoAnalytics: DemoMatchAnalytics | null;
  demoUrl: string | null;
  matchId?: string;
  onRequestParse?: () => void;
  isParsing?: boolean;
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
  if (!demoAnalytics && !demoUrl) return null;

  // Demo URL exists but no analytics started yet
  if (!demoAnalytics && demoUrl) {
    return (
      <div className="border border-border rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-dim">Demo available</span>
          <div className="flex items-center gap-2">
            {onRequestParse && (
              <button
                type="button"
                onClick={onRequestParse}
                disabled={isParsing}
                className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded hover:bg-accent/20 transition-colors disabled:opacity-50"
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

  if (!demoAnalytics) return null;

  const statusInfo = STATUS_LABELS[demoAnalytics.ingestionStatus] ?? {
    label: demoAnalytics.ingestionStatus,
    color: "text-text-dim",
  };

  return (
    <div className="border border-border rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim">Demo analytics</span>
        <div className="flex items-center gap-2">
          {demoAnalytics.ingestionStatus === "failed" && onRequestParse && (
            <button
              type="button"
              onClick={onRequestParse}
              disabled={isParsing}
              className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded hover:bg-error/20 transition-colors disabled:opacity-50"
            >
              Retry
            </button>
          )}
          <span className={`text-[10px] font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>
      {demoAnalytics.ingestionStatus === "parsed" && (
        <div className="text-[10px] text-text-dim mt-1">
          {demoAnalytics.totalRounds} rounds · {demoAnalytics.sourceType === "faceit_demo_url" ? "FACEIT" : "Manual"} source
        </div>
      )}
      {demoAnalytics.ingestionStatus === "parsing" && (
        <div className="text-[10px] text-blue-400 mt-1 animate-pulse">
          Parsing demo file...
        </div>
      )}
    </div>
  );
}
