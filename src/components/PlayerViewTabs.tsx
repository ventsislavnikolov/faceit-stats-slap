import { Link } from "@tanstack/react-router";
import { getPlayerViewTabs, type PlayerView } from "~/lib/player-view-shell";
import type { TrackedResolutionSearch } from "~/lib/tracked-player-alias";

interface PlayerViewTabsProps {
  activeView: PlayerView;
  locked?: TrackedResolutionSearch;
  nickname: string | null;
}

export function PlayerViewTabs({
  activeView,
  nickname,
  locked,
}: PlayerViewTabsProps) {
  const tabs = getPlayerViewTabs({ activeView, nickname, locked });

  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const className = `rounded px-4 py-2 text-xs font-bold transition-colors ${
          tab.isActive
            ? "bg-accent text-bg"
            : "bg-bg-elevated text-text-muted hover:text-text"
        } ${tab.isDisabled ? "pointer-events-none opacity-50" : ""}`;

        if (!tab.href) {
          return (
            <span className={className} key={tab.view}>
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            className={className}
            key={tab.view}
            params={tab.href.params as never}
            search={tab.href.search as never}
            to={tab.href.to as never}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
