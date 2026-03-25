import type { FriendWithStats } from "~/lib/types";
import { StreakBar } from "./StreakBar";

interface FriendCardProps {
  friend: FriendWithStats;
  isLive: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function FriendCard({
  friend,
  isSelected,
  isLive,
  onClick,
}: FriendCardProps) {
  const isPlaying = friend.isPlaying;

  return (
    <div
      className={`cursor-pointer rounded-lg p-2.5 transition-colors ${
        isPlaying
          ? "border border-accent/30 bg-accent/5"
          : "border border-transparent bg-bg-elevated"
      } ${isSelected ? "ring-1 ring-accent" : ""} hover:border-accent/40`}
      onClick={onClick}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs ${
            isPlaying
              ? "border-2 border-accent bg-accent/15 text-accent"
              : "border border-border bg-bg-card text-text-dim"
          }`}
        >
          {friend.nickname[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate font-bold text-sm ${isPlaying ? "text-accent" : "text-text-muted"}`}
            >
              {friend.nickname}
            </span>
            {isLive && (
              <span className="rounded bg-twitch/20 px-1.5 text-[9px] text-twitch">
                LIVE
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-muted">
            ELO {friend.elo.toLocaleString()} · Lvl {friend.skillLevel}
          </div>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-2 gap-1">
        {[
          {
            label: "K/D",
            value: friend.lifetimeKd.toFixed(2),
            highlight: friend.lifetimeKd >= 1.2,
            tooltip: "Kill/Death ratio",
          },
          {
            label: "HS%",
            value: `${friend.lifetimeHs}%`,
            highlight: friend.lifetimeHs >= 55,
            tooltip: "Headshot percentage",
          },
          {
            label: "ADR",
            value: friend.lifetimeAdr.toFixed(0),
            highlight: false,
            tooltip: "Average Damage per Round",
          },
          {
            label: "WR",
            value: `${friend.winRate}%`,
            highlight: friend.winRate >= 55,
            tooltip: "Win rate percentage",
          },
        ].map((stat) => (
          <div
            className="group/stat relative cursor-help rounded bg-bg-card px-1.5 py-1"
            key={stat.label}
          >
            <div className="text-[9px] text-text-dim uppercase">
              {stat.label}
            </div>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-bg-card px-2 py-1 font-normal text-[9px] text-text normal-case tracking-normal shadow-lg group-hover/stat:block">
              {stat.tooltip}
            </span>
            <div
              className={`font-bold text-sm ${stat.highlight ? "text-accent" : "text-text"}`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <StreakBar results={friend.recentResults} />
    </div>
  );
}
