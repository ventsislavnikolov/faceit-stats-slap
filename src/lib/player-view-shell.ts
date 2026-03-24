export type PlayerView = "friends" | "history" | "leaderboard";

export interface PlayerViewHref {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | number>;
}

export interface PlayerViewTab {
  view: PlayerView;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  href: PlayerViewHref | null;
}

export function getPlayerViewHref(view: PlayerView, nickname: string): PlayerViewHref {
  switch (view) {
    case "friends":
      return {
        to: "/$nickname",
        params: { nickname },
      };
    case "history":
      return {
        to: "/history",
        search: {
          player: nickname,
          matches: "yesterday",
          queue: "all",
        },
      };
    case "leaderboard":
      return {
        to: "/leaderboard",
        search: {
          player: nickname,
        },
      };
  }
}

export function getPlayerViewTabs({
  activeView,
  nickname,
}: {
  activeView: PlayerView;
  nickname: string | null;
}): PlayerViewTab[] {
  const views: Array<{ view: PlayerView; label: string }> = [
    { view: "friends", label: "Friends" },
    { view: "history", label: "History" },
    { view: "leaderboard", label: "Leaderboard" },
  ];

  return views.map(({ view, label }) => ({
    view,
    label,
    isActive: view === activeView,
    isDisabled: !nickname,
    href: nickname ? getPlayerViewHref(view, nickname) : null,
  }));
}
