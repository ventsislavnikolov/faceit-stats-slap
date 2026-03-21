export const TRACKED_FRIENDS = [
  "ad8034c1-6324-4080-b28e-dbf04239670a",
  "6de05371-90a0-4972-a96a-1bcc3381cfc6",
  "bbd4a555-939b-437b-a190-1de7791ff226",
  "28eef11b-a1d5-49f2-8130-627061f36cc1",
  "65c93ab1-d2b2-416c-a5d1-d45452c9517d",
  "e42f5e99-4920-4b54-844b-b63cb3274005",
  "f5f5d541-11c4-420d-bcaa-c84bec02f96e",
  "fdcdb5a0-cd0a-41de-81fd-0400b1240f4f",
  "d1e26999-1a9d-492e-ba78-84e083aa0dd0",
  "8e42d5f3-b4e9-4a67-b402-be0ac3c0260b",
  "57a110e4-fca7-4579-905e-d1cafe9dd3f5",
  "efc75558-1aea-4725-b1a6-13e78ec2e5f7",
  "c061d134-4643-4e55-8f07-32f845f47f0a",
  "65dd9a3c-15bc-425e-977a-cfc65e1e8375",
  "3a1c4a9b-5451-4ae6-a6f9-8fd448e47139",
  "40102345-6749-486e-9a6b-20824550175a",
  "208e0951-30cb-4804-b41d-424a843042e9",
  "e4603534-add6-47c9-bb71-a723758f215e",
  "63f331ae-ed7f-4a60-8227-3955ebcba342",
] as const;

export const MY_FACEIT_ID = "15844c99-d26e-419e-bd14-30908f502c03";
export const MY_NICKNAME = "soavarice";

export const TWITCH_MAP: Record<string, string> = {
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
