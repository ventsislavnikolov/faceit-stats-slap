export const MY_FACEIT_ID = "15844c99-d26e-419e-bd14-30908f502c03";
export const MY_NICKNAME = "soavarice";

export const TWITCH_MAP: Record<string, string | undefined> = {
  "ad8034c1-6324-4080-b28e-dbf04239670a": "bachiyski",  // TibaBG
  "65c93ab1-d2b2-416c-a5d1-d45452c9517d": "kasheto88",  // F1aw1esss
  "15844c99-d26e-419e-bd14-30908f502c03": "soavarice",   // soavarice
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
