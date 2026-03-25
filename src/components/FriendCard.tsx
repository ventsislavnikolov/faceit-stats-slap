import type { FriendWithStats } from "~/lib/types";
import { StreakBar } from "./StreakBar";

interface FriendCardProps {
  friend: FriendWithStats;
  isSelected: boolean;
  isLive: boolean;
  onClick: () => void;
}

export function FriendCard({ friend, isSelected, isLive, onClick }: FriendCardProps) {
  const isPlaying = friend.isPlaying;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg p-2.5 cursor-pointer transition-colors ${
        isPlaying
          ? "bg-accent/5 border border-accent/30"
          : "bg-bg-elevated border border-transparent"
      } ${isSelected ? "ring-1 ring-accent" : ""} hover:border-accent/40`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isPlaying
              ? "bg-accent/15 border-2 border-accent text-accent"
              : "bg-bg-card border border-border text-text-dim"
          }`}
        >
          {friend.nickname[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-bold truncate ${isPlaying ? "text-accent" : "text-text-muted"}`}
            >
              {friend.nickname}
            </span>
            {isLive && (
              <span className="text-[9px] text-twitch bg-twitch/20 px-1.5 rounded">LIVE</span>
            )}
          </div>
          <div className="text-[10px] text-text-muted">
            ELO {friend.elo.toLocaleString()} · Lvl {friend.skillLevel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {[
          { label: "K/D", value: friend.lifetimeKd.toFixed(2), highlight: friend.lifetimeKd >= 1.2, tooltip: "Kill/Death ratio" },
          { label: "HS%", value: `${friend.lifetimeHs}%`, highlight: friend.lifetimeHs >= 55, tooltip: "Headshot percentage" },
          { label: "ADR", value: friend.lifetimeAdr.toFixed(0), highlight: false, tooltip: "Average Damage per Round" },
          { label: "WR", value: `${friend.winRate}%`, highlight: friend.winRate >= 55, tooltip: "Win rate percentage" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded px-1.5 py-1 group/stat relative cursor-help">
            <div className="text-[9px] text-text-dim uppercase">{stat.label}</div>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 hidden group-hover/stat:block whitespace-nowrap rounded bg-bg-card border border-border px-2 py-1 text-[9px] normal-case tracking-normal font-normal text-text shadow-lg">
              {stat.tooltip}
            </span>
            <div className={`text-sm font-bold ${stat.highlight ? "text-accent" : "text-text"}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <StreakBar results={friend.recentResults} />
    </div>
  );
}
