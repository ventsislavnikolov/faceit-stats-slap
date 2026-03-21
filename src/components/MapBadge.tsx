import { getMapColor } from "~/lib/constants";

interface MapBadgeProps {
  map: string;
}

export function MapBadge({ map }: MapBadgeProps) {
  const color = getMapColor(map);
  const name = map.replace("de_", "");
  return (
    <span
      className="text-xs px-2 py-0.5 rounded"
      style={{ color, backgroundColor: `${color}22` }}
    >
      {name}
    </span>
  );
}
