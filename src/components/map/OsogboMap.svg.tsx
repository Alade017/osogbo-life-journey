import { useMemo, useState } from "react";
import {
  BusFront,
  Church,
  HeartPulse,
  Landmark,
  MapPin,
  School,
  ShoppingBasket,
  Trophy,
  Utensils,
} from "lucide-react";
import mapData from "@/data/osogbo-map.json";
import "./osogbo-map.css";

type LandmarkCategory =
  | "market"
  | "transport"
  | "school"
  | "health"
  | "worship"
  | "junction"
  | "sport"
  | "food"
  | "services";

type DistrictTheme = "market" | "residential" | "leisure" | "transport" | "school" | "outskirts";
type Traffic = "low" | "medium" | "high";

type MapLandmark = {
  id: string;
  label: string;
  category: LandmarkCategory;
  x: number;
  y: number;
  verify: boolean;
};

export type MapDistrict = {
  id: string;
  name: string;
  verify?: boolean;
  theme: DistrictTheme;
  traffic: Traffic;
  description: string;
  landmarks: MapLandmark[];
};

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

const districts = mapData.districts as MapDistrict[];

const districtFill: Record<DistrictTheme, string> = {
  market: "#E7D9B4",
  residential: "#DDE6F5",
  leisure: "#B9CCF0",
  transport: "#D9DEE6",
  school: "#F8F3F0",
  outskirts: "#E9EDF2",
};

const districtShade: Record<DistrictTheme, string> = {
  market: "#D0C197",
  residential: "#BCC9DE",
  leisure: "#98ADD5",
  transport: "#BAC3D0",
  school: "#E0D6D1",
  outskirts: "#D1D8E1",
};

const categoryIcons = {
  market: ShoppingBasket,
  transport: BusFront,
  school: School,
  health: HeartPulse,
  worship: Church,
  junction: MapPin,
  sport: Trophy,
  food: Utensils,
  services: Landmark,
} satisfies Record<LandmarkCategory, typeof MapPin>;

function districtBounds(district: MapDistrict): Bounds {
  const xs = district.landmarks.map((landmark) => landmark.x);
  const ys = district.landmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = 70;
  const padTop = 72;
  const padBottom = 52;

  return {
    x: minX - padX,
    y: minY - padTop,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  };
}

function boundsCenter(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function roadPath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

function roadRoutes(districtBoundsById: Map<string, Bounds>) {
  const rows = [districts.slice(0, 4), districts.slice(4, 8)];
  const horizontalRoutes = rows.map((row) => {
    const points = row
      .map((district) => districtBoundsById.get(district.id))
      .filter((bounds): bounds is Bounds => !!bounds)
      .map(boundsCenter)
      .sort((a, b) => a.x - b.x);
    return roadPath(points);
  });

  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];
  const verticalRoutes = [0, 2].map((leftIndex) => {
    const upperLeft = districtBoundsById.get(firstRow[leftIndex]?.id ?? "");
    const upperRight = districtBoundsById.get(firstRow[leftIndex + 1]?.id ?? "");
    const lowerLeft = districtBoundsById.get(secondRow[leftIndex]?.id ?? "");
    const lowerRight = districtBoundsById.get(secondRow[leftIndex + 1]?.id ?? "");
    if (!upperLeft || !upperRight || !lowerLeft || !lowerRight) return "";

    const upperGapX = (upperLeft.x + upperLeft.width + upperRight.x) / 2;
    const lowerGapX = (lowerLeft.x + lowerLeft.width + lowerRight.x) / 2;
    const upperGapY = Math.max(upperLeft.y + upperLeft.height, upperRight.y + upperRight.height);
    const lowerGapY = Math.min(lowerLeft.y, lowerRight.y);
    return roadPath([
      { x: upperGapX, y: upperGapY },
      { x: (upperGapX + lowerGapX) / 2, y: (upperGapY + lowerGapY) / 2 },
      { x: lowerGapX, y: lowerGapY },
    ]);
  });

  return [...horizontalRoutes, ...verticalRoutes].filter(Boolean);
}

export type OsogboMapSvgProps = {
  labelsVisible?: boolean;
  selectedDistrictId?: string | null;
  onDistrictSelect?: (district: MapDistrict) => void;
  onLandmarkSelect?: (landmark: MapLandmark, district: MapDistrict) => void;
};

export function OsogboMapSvg({
  labelsVisible = false,
  selectedDistrictId,
  onDistrictSelect,
  onLandmarkSelect,
}: OsogboMapSvgProps) {
  const { boundsById, roads } = useMemo(() => {
    const bounds = new Map(districts.map((district) => [district.id, districtBounds(district)]));
    return { boundsById: bounds, roads: roadRoutes(bounds) };
  }, []);

  return (
    <svg
      className="osogbo-map-svg"
      viewBox="0 0 1200 800"
      role="group"
      aria-label="Hand-placed Osogbo district map"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect className="map-background" width="1200" height="800" />

      <g className="map-roads" aria-label="Roads">
        {roads.map((path, index) => (
          <g className="map-road" key={`road-${index}`}>
            <path d={path} className="map-road-edge" />
            <path d={path} className="map-road-fill" />
          </g>
        ))}
      </g>

      <g className="map-districts" aria-label="Districts">
        {districts.map((district) => {
          const bounds = boundsById.get(district.id);
          if (!bounds) return null;
          const trafficCount = district.traffic === "high" ? 3 : district.traffic === "medium" ? 2 : 1;
          const isSelected = selectedDistrictId === district.id;
          const activate = () => onDistrictSelect?.(district);

          return (
            <g
              id={`district-${district.id}`}
              data-district-id={district.id}
              className={`map-district${isSelected ? " is-selected" : ""}`}
              key={district.id}
              role="button"
              tabIndex={0}
              aria-label={`${district.name}, ${district.traffic} traffic`}
              aria-pressed={isSelected}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
            >
              <rect
                className="map-district-depth"
                x={bounds.x + 2}
                y={bounds.y + 4}
                width={bounds.width}
                height={bounds.height}
                rx="12"
                fill={districtShade[district.theme]}
              />
              <rect
                className="map-district-shape"
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                rx="12"
                fill={districtFill[district.theme]}
              />
              <text className="map-district-name" x={bounds.x + 14} y={bounds.y + 26}>
                {district.name}
              </text>
              <text className="map-district-theme" x={bounds.x + 14} y={bounds.y + 43}>
                {district.theme.toUpperCase()}
                {district.verify ? " · VERIFY" : ""}
              </text>
              <g className="traffic" aria-label={`${district.traffic} traffic`}>
                {[0, 1, 2].map((bar) => (
                  <rect
                    className={bar < trafficCount ? "traffic-bar is-active" : "traffic-bar"}
                    key={bar}
                    x={bounds.x + bounds.width - 45 + bar * 9}
                    y={bounds.y + 23 - bar * 2}
                    width="5"
                    height={7 + bar * 2}
                    rx="2"
                  />
                ))}
                <text className="traffic-label" x={bounds.x + bounds.width - 45} y={bounds.y + 42}>
                  {district.traffic.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      <g
        className={`map-landmarks${labelsVisible ? " show-landmark-labels" : ""}`}
        aria-label="Landmarks"
      >
        {districts.flatMap((district) =>
          district.landmarks.map((landmark) => {
            const Icon = categoryIcons[landmark.category];
            const activate = () => onLandmarkSelect?.(landmark, district);
            return (
              <g
                id={`landmark-${landmark.id}`}
                data-landmark-id={landmark.id}
                className="map-landmark"
                key={landmark.id}
                role="button"
                tabIndex={0}
                aria-label={`${landmark.label}, ${district.name}${landmark.verify ? ", needs verification" : ""}`}
                onClick={activate}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                  }
                }}
              >
                <circle className="map-landmark-marker" cx={landmark.x} cy={landmark.y} r="13" />
                <Icon
                  className="map-landmark-icon"
                  x={landmark.x - 12}
                  y={landmark.y - 12}
                  width={24}
                  height={24}
                  aria-hidden="true"
                />
                <text
                  className="landmark-label"
                  aria-hidden={!labelsVisible}
                  x={landmark.x}
                  y={landmark.y + 28}
                >
                  {landmark.label}
                </text>
                {landmark.verify && (
                  <circle
                    className="map-review-dot"
                    cx={landmark.x + 10}
                    cy={landmark.y - 10}
                    r="3"
                    aria-label="Name or category needs review"
                  />
                )}
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );
}
