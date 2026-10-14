import { useState } from "react";
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
import "./osogbo-district-map.css";

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

type MapLandmark = {
  id: string;
  label: string;
  category: LandmarkCategory;
  x: number;
  y: number;
  verify: boolean;
};

type MapDistrict = {
  id: string;
  name: string;
  verify?: boolean;
  theme: "market" | "residential" | "leisure" | "transport" | "school" | "outskirts";
  traffic: "low" | "medium" | "high";
  description: string;
  landmarks: MapLandmark[];
};

const districts = mapData.districts as MapDistrict[];
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

export function OsogboDistrictMap() {
  const [selected, setSelected] = useState<{
    district: MapDistrict;
    landmark: MapLandmark;
  } | null>(null);

  return (
    <section className="district-map" aria-label="Stylised hand-placed map of Osogbo districts">
      <div className="district-map-heading">
        <span className="district-map-kicker">OSOGBO · DISTRICT GUIDE</span>
        <strong>Find your next stop</strong>
        <span>Hand-placed game map · not to geographic scale</span>
      </div>

      <svg
        className="district-map-art"
        viewBox="0 0 1200 800"
        role="group"
        aria-label="Eight districts with selectable landmarks"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="district-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--brand-ink)" opacity="0.08" />
          </pattern>
          <linearGradient id="district-map-water" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--scene-sky)" />
            <stop offset="1" stopColor="var(--brand-porcelain)" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="var(--brand-porcelain)" />
        <rect width="1200" height="800" fill="url(#district-map-grid)" />
        <path
          className="district-map-river"
          d="M-40 396 C130 335 235 448 380 401 S620 344 760 411 S1000 459 1240 350"
          fill="none"
          stroke="url(#district-map-water)"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          className="district-map-road district-map-road-main"
          d="M42 399 C220 367 355 423 505 399 S820 377 1160 404 M600 70 C570 260 650 480 600 735"
          fill="none"
          stroke="var(--scene-road)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          className="district-map-road-marking"
          d="M42 399 C220 367 355 423 505 399 S820 377 1160 404 M600 70 C570 260 650 480 600 735"
          fill="none"
          stroke="var(--scene-marking)"
          strokeWidth="2"
          strokeDasharray="12 15"
          strokeLinecap="round"
        />

        {districts.map((district, index) => {
          const col = index % 4;
          const row = Math.floor(index / 4);
          const x = 30 + col * 300;
          const y = row === 0 ? 74 : 455;
          return (
            <g className={`district-map-district theme-${district.theme}`} key={district.id}>
              <rect
                className="district-map-district-plate"
                x={x}
                y={y}
                width="250"
                height="300"
                rx="26"
              />
              <text className="district-map-district-index" x={x + 22} y={y + 34}>
                DISTRICT 0{index + 1}
              </text>
              <text className="district-map-district-name" x={x + 22} y={y + 65}>
                {district.name}
              </text>
              <text className="district-map-district-meta" x={x + 22} y={y + 86}>
                {district.theme.toUpperCase()} · {district.traffic.toUpperCase()} TRAFFIC
                {district.verify ? " · VERIFY" : ""}
              </text>
              {district.landmarks.map((landmark) => {
                const Icon = categoryIcons[landmark.category];
                const isSelected = selected?.landmark.id === landmark.id;
                return (
                  <g
                    className={`district-map-landmark${isSelected ? " is-selected" : ""}`}
                    key={landmark.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${landmark.label}, ${district.name}${landmark.verify ? ", needs verification" : ""}`}
                    onClick={() => setSelected({ district, landmark })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected({ district, landmark });
                      }
                    }}
                  >
                    <circle
                      className="district-map-marker-halo"
                      cx={landmark.x}
                      cy={landmark.y}
                      r="22"
                    />
                    <circle
                      className="district-map-marker"
                      cx={landmark.x}
                      cy={landmark.y}
                      r="17"
                    />
                    <Icon
                      className="district-map-marker-icon"
                      size={18}
                      x={landmark.x - 9}
                      y={landmark.y - 9}
                      aria-hidden="true"
                    />
                    <text
                      className="district-map-landmark-label"
                      x={landmark.x}
                      y={landmark.y + 39}
                    >
                      {landmark.label}
                    </text>
                    {landmark.verify && (
                      <text
                        className="district-map-verify"
                        x={landmark.x + 13}
                        y={landmark.y - 14}
                        aria-hidden="true"
                      >
                        ?
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {selected && (
        <aside className="district-map-selection" aria-live="polite">
          <button
            className="district-map-selection-close"
            type="button"
            aria-label="Close landmark details"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <span>
            {selected.district.name} · {selected.landmark.category}
          </span>
          <strong>{selected.landmark.label}</strong>
          <p>{selected.district.description}</p>
          {(selected.landmark.verify || selected.district.verify) && (
            <small>District name or landmark details need local verification.</small>
          )}
        </aside>
      )}

      <div className="district-map-legend" aria-label="Map legend">
        <span>
          <i className="legend-road" /> Main route
        </span>
        <span>
          <i className="legend-pin" /> Selectable place
        </span>
        <span>
          <i className="legend-review">?</i> Review name or category
        </span>
      </div>
    </section>
  );
}
