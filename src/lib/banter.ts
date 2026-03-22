type BanterType = "carry" | "roast";

const CARRY_LINES = [
  "{name} carried harder than a shopping bag",
  "{name} turned the server into a highlight reel",
  "The other team is still looking for {name}",
  "{name} chose violence today",
  "Rename the match to the {name} show",
  "{name} made the whole lobby question their rank",
  "{name} just put that on the resume",
  "{name} was playing a different game than everyone else",
  "Someone check {name}'s gaming chair",
  "{name} went full action movie protagonist",
  "{name} didn't come to play, they came to dominate",
  "The server should thank {name} for the content",
  "{name} treated the match like aim practice",
  "{name} woke up and chose destruction",
  "{name} had the lobby on speed dial",
  "{name} hit shots like rent was due",
  "{name} left fingerprints on every round",
  "{name} was farming clips, not enemies",
  "{name} made top frag look like a birthright",
  "{name} had the crosshair on autopilot",
  "{name} spent the match collecting souls",
  "{name} was handing out one-way tickets to spawn",
  "{name} made the scoreboard look photoshopped",
  "{name} was deleting people on contact",
  "{name} ran the server like a private lobby",
  "{name} was so hot the deagle needed oven mitts",
  "{name} had everyone else queued as background actors",
  "{name} was dropping rounds into the win column by hand",
  "{name} made every duel look pre-recorded",
  "{name} was one tap away from a montage contract",
  "{name} put the lobby in a group project and did all the work",
  "{name} was speedrunning MVPs",
  "{name} turned every peek into a bad life choice",
  "{name} was making crosshair placement look like witchcraft",
  "{name} had the enemy team checking for smurfs in the ceiling",
];

const ROAST_LINES = [
  "{name} was the team's emotional support",
  "{name} brought good vibes instead of aim",
  "{name} was just there for the company",
  "At least {name} had fun... right?",
  "{name} played like their monitor was off",
  "{name} contributed moral support",
  "{name} was busy admiring the map design",
  "{name} brought snacks instead of frags",
  "{name} was lagging in spirit",
  "{name} had a nice workout pressing W",
  "{name} was sightseeing on the map",
  "{name} mistook this for a walking simulator",
  "{name} was providing valuable intel... to the enemy",
  "{name} was playing on a steering wheel",
  "{name} was in the lobby for warmth",
  "{name} was on a strict no-frag diet",
  "{name} was playing hide and seek without the hide part",
  "{name} turned every duel into a charity donation",
  "{name} was trying to win with positive body language",
  "{name} looked allergic to the scoreboard",
  "{name} was buffering in real time",
  "{name} was serving warm-up vibes in a live match",
  "{name} made bottom frag look like a calling",
  "{name} was testing if helmets really work",
  "{name} was collecting deaths like loyalty points",
  "{name} had more footsteps than impact",
  "{name} was roleplaying a free kill",
  "{name} entered sites like they forgot the flash at home",
  "{name} was making the minimap feel crowded",
  "{name} had a long-term lease in spectator mode",
  "{name} was playing every round on hard mode by choice",
  "{name} was donating aim data to science",
  "{name} made recoil control look optional",
  "{name} was committed to the bit, unfortunately the bit was losing",
  "{name} was out there building character instead of stats",
];

function hashMatchId(matchId: string): number {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = (hash * 31 + matchId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getBanterLine(
  type: BanterType,
  name: string,
  matchId: string
): string {
  const lines = type === "carry" ? CARRY_LINES : ROAST_LINES;
  const index = hashMatchId(matchId + type) % lines.length;
  return lines[index].replace("{name}", name);
}

export function getBanterCatalogSize(type: BanterType): number {
  return (type === "carry" ? CARRY_LINES : ROAST_LINES).length;
}
