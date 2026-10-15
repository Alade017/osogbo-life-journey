import mapData from "@/data/osogbo-map.json";
import { isoCellToScreen } from "@/lib/map-projection";
import type { MapDistrict } from "@/components/map/OsogboMap.svg";

const fill: Record<string, string> = {
  market: "#E7D9B4",
  residential: "#DDE6F5",
  leisure: "#B9CCF0",
  transport: "#D9DEE6",
  school: "#F8F3F0",
  outskirts: "#E9EDF2",
};

export function IsometricMapSvg({
  onSelectDistrict,
}: {
  onSelectDistrict: (district: MapDistrict) => void;
}) {
  const districts = mapData.districts as MapDistrict[];
  const roads = [
    [
      { col: -1, row: 2.5 },
      { col: 13, row: 2.5 },
    ],
    [
      { col: -1, row: 4 },
      { col: 13, row: 4 },
    ],
    [
      { col: 2.5, row: -1 },
      { col: 2.5, row: 8 },
    ],
    [
      { col: 8.5, row: -1 },
      { col: 8.5, row: 8 },
    ],
  ];
  const path = (points: { col: number; row: number }[]) =>
    points
      .map((point, index) => {
        const projected = isoCellToScreen(point);
        return `${index === 0 ? "M" : "L"}${projected.x},${projected.y}`;
      })
      .join(" ");

  return (
    <svg
      className="osogbo-map-svg isometric-map-svg"
      viewBox="0 0 1200 800"
      role="group"
      aria-label="Isometric Osogbo district map"
    >
      <rect className="map-background" width="1200" height="800" />
      <g className="isometric-roads" aria-label="Roads">
        {roads.map((road, index) => (
          <g key={index}>
            <path d={path(road)} fill="none" stroke="#D9DEE6" strokeWidth="17" />
            <path d={path(road)} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          </g>
        ))}
      </g>
      <g className="map-districts" aria-label="Districts">
        {districts.map((district) => {
          const cells = district.isoCells ?? [];
          if (!cells.length) return null;
          const activate = () => onSelectDistrict(district);
          return (
            <g
              key={district.id}
              id={`district-${district.id}`}
              data-district-id={district.id}
              className="map-district isometric-district"
              role="button"
              tabIndex={0}
              aria-label={`${district.name}, ${district.traffic} traffic`}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
            >
              {cells.map((cell, index) => {
                const points = [
                  { col: cell.col, row: cell.row - 0.5 },
                  { col: cell.col + 0.5, row: cell.row },
                  { col: cell.col, row: cell.row + 0.5 },
                  { col: cell.col - 0.5, row: cell.row },
                ].map((point) => isoCellToScreen(point, district.height ?? 0));
                const coords = points.map(({ x, y }) => `${x},${y}`).join(" ");
                const offset = points.map(({ x, y }) => `${x + 2},${y + 4}`).join(" ");
                return (
                  <g key={`${district.id}-cell-${index}`}>
                    <polygon points={offset} fill="#14213D" fillOpacity=".12" />
                    <polygon
                      className="map-district-shape"
                      points={coords}
                      fill={fill[district.theme]}
                    />
                  </g>
                );
              })}
              {(() => {
                const center = cells.reduce(
                  (sum, cell) => ({ col: sum.col + cell.col, row: sum.row + cell.row }),
                  { col: 0, row: 0 },
                );
                const projected = isoCellToScreen(
                  { col: center.col / cells.length, row: center.row / cells.length },
                  district.height ?? 0,
                );
                const count =
                  district.traffic === "high" ? 3 : district.traffic === "medium" ? 2 : 1;
                return (
                  <g className="isometric-district-label" pointerEvents="none">
                    <text
                      x={projected.x}
                      y={projected.y - 3}
                      textAnchor="middle"
                      className="map-district-name"
                    >
                      {district.name}
                    </text>
                    <text
                      x={projected.x}
                      y={projected.y + 15}
                      textAnchor="middle"
                      className="map-district-theme"
                    >
                      {district.traffic[0]!.toUpperCase() + district.traffic.slice(1)} traffic
                    </text>
                    {[0, 1, 2].map((bar) => (
                      <rect
                        key={bar}
                        x={projected.x - 15 + bar * 9}
                        y={projected.y + 22 - (bar < count ? 3 : 0)}
                        width="5"
                        height={bar < count ? 7 : 4}
                        rx="2"
                        className={bar < count ? "traffic-bar is-active" : "traffic-bar"}
                      />
                    ))}
                  </g>
                );
              })()}
              <title>{district.name}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
