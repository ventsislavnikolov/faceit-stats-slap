import { getMapColor } from "~/lib/constants";

interface MapBadgeProps {
  map: string;
}

export function MapBadge({ map }: MapBadgeProps) {
  const color = getMapColor(map);
  const name = map.replace("de_", "");
  return (
    <span
      className="rounded px-2 py-0.5 text-xs"
      style={{ color, backgroundColor: `${color}22` }}
    >
      {name}
    </span>
  );
}
