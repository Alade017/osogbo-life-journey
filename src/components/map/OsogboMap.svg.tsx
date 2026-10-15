import { useEffect, useState } from "react";
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

export type MapLandmark = {
  id: string;
  label: string;
  category: LandmarkCategory;
  x: number;
  y: number;
  verify: boolean;
  source?: string;
  isoCell?: { col: number; row: number };
  buildingId?: string;
  actions?: MapPlaceAction[];
};

export type MapBuilding = {
  id: string;
  landmark_id: string;
  name: string;
  short_name?: string;
  category: LandmarkCategory;
  position: { col: number; row: number };
  footprint: { width: number; depth: number };
  facade_slot?: string;
  verify: boolean;
};

export type MapTownProp = {
  id: string;
  kind: "home" | "shop" | "tree";
  position: { col: number; row: number };
  footprint: { width: number; depth: number };
  interactive: false;
  verify: boolean;
};

export type MapPlaceAction = {
  id: string;
  label: string;
  description: string;
  time_cost_minutes: number;
  money_minor: { min: number; max: number };
  mood_effect: number;
  requirement: string;
  open_hours: { start: number; end: number };
  cooldown_game_minutes?: number;
  needs_effects?: { hunger_satisfaction?: number };
  verify: boolean;
};

export type MapDistrict = {
  id: string;
  name: string;
  verify?: boolean;
  theme: DistrictTheme;
  traffic: Traffic;
  description: string;
  shape: [number, number][];
  source?: string;
  isoCells?: { col: number; row: number }[];
  height?: number;
  landmarks: MapLandmark[];
  buildings?: MapBuilding[];
  props?: MapTownProp[];
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

const roads = [
  "M-60 270 C140 285 235 330 390 350 S670 375 810 340 S1050 315 1260 350",
  "M-60 590 C170 560 270 505 430 500 S700 535 860 495 S1080 430 1260 425",
  "M285 -50 C305 115 335 245 310 365 S290 615 345 850",
  "M875 -50 C845 140 815 255 855 375 S905 620 845 850",
];

export type OsogboMapSvgProps = {
  data?: typeof mapData;
  labelsVisible?: boolean;
  showLandmarks?: boolean;
  selectedDistrictId?: string | null;
  onDistrictSelect?: (district: MapDistrict) => void;
  onLandmarkSelect?: (landmark: MapLandmark, district: MapDistrict) => void;
};

export function OsogboMapSvg({
  data = mapData,
  labelsVisible = false,
  showLandmarks = true,
  selectedDistrictId,
  onDistrictSelect,
  onLandmarkSelect,
}: OsogboMapSvgProps) {
  const districts = data.districts as MapDistrict[];
  const [reviewMode, setReviewMode] = useState(false);
  useEffect(() => {
    setReviewMode(new URLSearchParams(window.location.search).get("review") === "1");
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

      <g className="map-districts" aria-label="Districts">
        {districts.map((district) => {
          if (district.shape.length < 6 || district.shape.length > 10) return null;
          const xs = district.shape.map(([x]) => x);
          const ys = district.shape.map(([, y]) => y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const points = district.shape.map(([x, y]) => `${x},${y}`).join(" ");
          const offsetPoints = district.shape.map(([x, y]) => `${x + 2},${y + 4}`).join(" ");
          const trafficCount =
            district.traffic === "high" ? 3 : district.traffic === "medium" ? 2 : 1;
          const isSelected = selectedDistrictId === district.id;
          const activate = () => onDistrictSelect?.(district);

          return (
            <g
              id={`district-${district.id}`}
              data-district-id={district.id}
              className={`map-district region-${district.theme}${isSelected ? " is-selected" : ""}`}
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
              <polygon
                className="map-district-depth"
                points={offsetPoints}
                fill="#14213D"
                fillOpacity="0.12"
              />
              <polygon className="map-district-shape" points={points} fill="currentColor" />
              <text className="map-district-name" x={minX + 18} y={minY + 30}>
                {district.name}
              </text>
              <text className="map-district-theme" x={minX + 18} y={minY + 47}>
                {district.theme[0]?.toUpperCase()}
                {district.theme.slice(1)}
                {reviewMode && district.verify ? " \u00b7 verify" : ""}
              </text>
              <g className="traffic" aria-label={`${district.traffic} traffic`}>
                {[0, 1, 2].map((bar) => (
                  <rect
                    className={bar < trafficCount ? "traffic-bar is-active" : "traffic-bar"}
                    key={bar}
                    x={minX + 58 + bar * 9}
                    y={maxY - 25 - bar * 2}
                    width="5"
                    height={7 + bar * 2}
                    rx="2"
                  />
                ))}
                <text className="traffic-label" x={minX + 94} y={maxY - 14}>
                  {district.traffic[0]?.toUpperCase()}
                  {district.traffic.slice(1)} traffic
                </text>
              </g>
            </g>
          );
        })}
      </g>

      <g className="map-roads" aria-label="Roads">
        {roads.map((path, index) => (
          <g className="map-road" key={`road-${index}`}>
            <path d={path} className="map-road-edge" />
            <path d={path} className="map-road-fill" />
          </g>
        ))}
      </g>

      {showLandmarks && (
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
                  aria-label={`${landmark.label}, ${district.name}${reviewMode && landmark.verify ? ", verify" : ""}`}
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
                    {reviewMode && landmark.verify ? " \u00b7 verify" : ""}
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
      )}
    </svg>
  );
}
