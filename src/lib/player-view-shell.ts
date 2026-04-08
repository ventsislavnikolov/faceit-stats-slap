import {
  isTrackedPlayerAlias,
  TRACKED_PLAYER_ALIAS,
  type TrackedResolutionSearch,
} from "~/lib/tracked-player-alias";

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
  nickname: string,
  locked?: TrackedResolutionSearch
): PlayerViewHref {
  const isTrackedFlow = isTrackedPlayerAlias(nickname);
  const playerSearchValue = isTrackedFlow ? TRACKED_PLAYER_ALIAS : nickname;
  const resolvedPlayerId = isTrackedFlow ? locked?.resolvedPlayerId : undefined;

  switch (view) {
    case "friends":
      if (isTrackedFlow) {
        return {
          to: `/${TRACKED_PLAYER_ALIAS}`,
          ...(resolvedPlayerId ? { search: { resolvedPlayerId } } : {}),
        };
      }

      return {
        to: "/$nickname",
        params: { nickname },
      };
    case "history":
      return {
        to: "/history",
        search: {
          player: playerSearchValue,
          ...(resolvedPlayerId ? { resolvedPlayerId } : {}),
          matches: 20,
          queue: "party",
        },
      };
    case "leaderboard":
      return {
        to: "/leaderboard",
        search: {
          player: playerSearchValue,
          ...(resolvedPlayerId ? { resolvedPlayerId } : {}),
          matches: 20,
          queue: "party",
          last: 30,
        },
      };
    case "last-party":
      return {
        to: "/last-party",
        search: {
          player: playerSearchValue,
          ...(resolvedPlayerId ? { resolvedPlayerId } : {}),
        },
      };
  }
}

export function getPlayerViewTabs({
  activeView,
  nickname,
  locked,
}: {
  activeView: PlayerView;
  nickname: string | null;
  locked?: TrackedResolutionSearch;
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
    href: nickname ? getPlayerViewHref(view, nickname, locked) : null,
  }));
}
