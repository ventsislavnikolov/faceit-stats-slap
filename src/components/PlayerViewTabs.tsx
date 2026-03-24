import { Link } from "@tanstack/react-router";
import { getPlayerViewTabs, type PlayerView } from "~/lib/player-view-shell";

interface PlayerViewTabsProps {
  activeView: PlayerView;
  nickname: string | null;
}

export function PlayerViewTabs({ activeView, nickname }: PlayerViewTabsProps) {
  const tabs = getPlayerViewTabs({ activeView, nickname });

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
            <span key={tab.view} className={className}>
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.view}
            to={tab.href.to as never}
            params={tab.href.params as never}
            search={tab.href.search as never}
            className={className}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
