import mapData from "@/data/osogbo-map.json";
import type { MapDistrict } from "@/components/map/OsogboMap.svg";
import { isoCellToScreen } from "@/lib/map-projection";

type CellPoint = { col: number; row: number };

const townRoads: CellPoint[][] = [
  [
    { col: -1, row: 2.25 },
    { col: 1, row: 2.05 },
    { col: 2.6, row: 2.4 },
    { col: 4.6, row: 2.18 },
    { col: 6.5, row: 2.48 },
    { col: 8.5, row: 2.2 },
    { col: 12, row: 2.45 },
  ],
  [
    { col: -1, row: 4.8 },
    { col: 1.1, row: 4.45 },
    { col: 2.6, row: 4.75 },
    { col: 4.7, row: 4.55 },
    { col: 6.8, row: 4.92 },
    { col: 8.7, row: 4.55 },
    { col: 12, row: 4.35 },
  ],
  [
    { col: 2.45, row: -1 },
    { col: 2.25, row: 0.8 },
    { col: 2.6, row: 2.4 },
    { col: 2.35, row: 3.5 },
    { col: 2.6, row: 4.75 },
    { col: 2.4, row: 7 },
  ],
  [
    { col: 8.55, row: -1 },
    { col: 8.8, row: 0.9 },
    { col: 8.5, row: 2.2 },
    { col: 8.75, row: 3.55 },
    { col: 8.7, row: 4.55 },
    { col: 8.6, row: 7 },
  ],
];

function projectPath(points: CellPoint[]) {
  return points
    .map((point, index) => {
      const projected = isoCellToScreen(point);
      return `${index === 0 ? "M" : "L"}${projected.x},${projected.y}`;
    })
    .join(" ");
}

function districtHull(district: MapDistrict) {
  const projected = (district.isoCells ?? []).flatMap((cell) =>
    [
      { col: cell.col, row: cell.row - 0.5 },
      { col: cell.col + 0.5, row: cell.row },
      { col: cell.col, row: cell.row + 0.5 },
      { col: cell.col - 0.5, row: cell.row },
    ].map((corner) => isoCellToScreen(corner, district.height ?? 0)),
  );
  const sorted = [...projected].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    origin: (typeof sorted)[number],
    a: (typeof sorted)[number],
    b: (typeof sorted)[number],
  ) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: typeof sorted = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: typeof sorted = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map(({ x, y }) => `${x},${y}`).join(" ");
}

export function IsometricMapSvg({
  onSelectDistrict,
}: {
  onSelectDistrict: (district: MapDistrict) => void;
}) {
  const districts = mapData.districts as MapDistrict[];
  return (
    <svg
      className="osogbo-map-svg isometric-map-svg"
      viewBox="0 0 1200 800"
      role="group"
      aria-label="Isometric Osogbo town map"
    >
      <rect className="map-background" width="1200" height="800" />
      <g className="town-green-belts" aria-hidden="true">
        {[
          [170, 248, 44, 18],
          [332, 486, 56, 22],
          [690, 170, 51, 19],
          [852, 522, 48, 20],
          [1042, 320, 63, 23],
          [530, 625, 58, 21],
        ].map(([cx, cy, rx, ry], index) => (
          <ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} className="town-green-patch" />
        ))}
      </g>

      <g className="town-district-regions" aria-label="Districts">
        {districts.map((district) => (
          <g
            key={district.id}
            className={`map-district isometric-district region-${district.theme}`}
            id={`district-${district.id}`}
            data-district-id={district.id}
            role="button"
            tabIndex={0}
            aria-label={`${district.name}, ${district.traffic} traffic`}
            onClick={() => onSelectDistrict(district)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectDistrict(district);
              }
            }}
          >
            <polygon className="district-region-shape" points={districtHull(district)} />
          </g>
        ))}
      </g>

      <g className="isometric-roads" aria-label="Roads">
        {townRoads.map((road, index) => {
          const d = projectPath(road);
          return (
            <g key={index} className="town-road">
              <path d={d} className="town-road-edge" />
              <path d={d} className="town-road-fill" />
              <path d={d} className="town-road-center" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
