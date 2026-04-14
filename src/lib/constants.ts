export const MY_FACEIT_ID = "15844c99-d26e-419e-bd14-30908f502c03";
export const MY_NICKNAME = "soavarice";

export const ADMIN_NICKNAMES = ["soavarice", "n_gyulev"] as const;

export function isAdminNickname(nickname: string | null | undefined): boolean {
  return (
    !!nickname && (ADMIN_NICKNAMES as readonly string[]).includes(nickname)
  );
}

export const BET_BLACKLIST = ["soavarice"] as const;

export function isBetBlacklisted(nickname: string | null | undefined): boolean {
  return !!nickname && (BET_BLACKLIST as readonly string[]).includes(nickname);
}

export const TWITCH_MAP: Record<string, string | undefined> = {
  "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b": "bachiyski", // TibaBG
  "65c93ab1-d2b2-416c-a5d1-d45452c9517d": "kasheto88", // F1aw1esss
  "15844c99-d26e-419e-bd14-30908f502c03": "soavarice", // soavarice
};

export const MAP_COLORS: Record<string, string> = {
  de_inferno: "#cc9944",
  de_dust2: "#ccaa88",
  de_nuke: "#44aacc",
  de_ancient: "#55aa77",
  de_mirage: "#aa77cc",
  de_anubis: "#77aa55",
  de_vertigo: "#55aacc",
};

const FALLBACK_MAP_COLOR = "#888888";

export function getMapColor(map: string): string {
  return MAP_COLORS[map] ?? FALLBACK_MAP_COLOR;
}

export function getTwitchChannel(faceitId: string): string | null {
  return TWITCH_MAP[faceitId] ?? null;
}
