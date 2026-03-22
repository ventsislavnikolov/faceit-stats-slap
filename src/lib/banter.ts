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
