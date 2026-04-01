export type PlayerView = "friends" | "history" | "leaderboard" | "last-party";

export interface PlayerViewHref {
  params?: Record<string, string>;
  search?: Record<string, string | number>;
  to: string;
}

export interface PlayerViewTab {
  href: PlayerViewHref | null;
  isActive: boolean;
  isDisabled: boolean;
  label: string;
  view: PlayerView;
}

export function getPlayerViewHref(
  view: PlayerView,
  nickname: string
): PlayerViewHref {
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
          matches: 20,
          queue: "party",
        },
      };
    case "leaderboard":
      return {
        to: "/leaderboard",
        search: {
          player: nickname,
          matches: 20,
          queue: "party",
          last: 30,
        },
      };
    case "last-party":
      return {
        to: "/last-party",
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
    { view: "last-party", label: "Last Party" },
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
