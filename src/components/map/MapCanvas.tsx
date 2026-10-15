import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BusFront,
  Church,
  HeartPulse,
  Landmark,
  MapPin,
  Megaphone,
  School,
  ShoppingBasket,
  Trophy,
  Utensils,
  Bus,
} from "lucide-react";
import mapData from "@/data/osogbo-map.json";
import {
  OsogboMapSvg,
  type MapBuilding,
  type MapDistrict,
  type MapLandmark,
  type MapTownProp,
} from "@/components/map/OsogboMap.svg";
import { IsometricMapSvg } from "@/components/map/IsometricMap.svg";
import {
  isoCellTo2dViewBox,
  isoCellToScreen,
  mapPointForMode,
  type MapProjectionMode,
} from "@/lib/map-projection";
import { isQuickMapTap, type MapPointerSample } from "@/lib/map-gesture";
import { layoutCityLabels } from "@/lib/city-label-layout";
import "./map-canvas.css";

export type MapZoomLevel = 1 | 2 | 3;
export type MapFilter = MapLandmark["category"] | "jobs" | "all";
export type MapSearchTarget = string | { id: string; kind?: "district" | "landmark" };

export type MapPlayerLocation = {
  x: number;
  y: number;
  label?: string;
  activity?: string;
  markerType?: "player" | "stall" | "job";
};

export type MapEventChip = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type MapBillboardMarker = {
  campaignId: string;
  landmarkId: string;
  advertiserName: string;
  count: number;
};

export interface MapCanvasProps {
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  activeFilter?: MapFilter;
  searchTarget?: MapSearchTarget | null;
  playerLocation?: MapPlayerLocation | null;
  eventChips?: MapEventChip[];
  jobLandmarkIds?: string[];
  billboardMarkers?: MapBillboardMarker[];
  onSelectBillboard?: (campaignId: string) => void;
}

type Point = { x: number; y: number };
type ViewTransform = { x: number; y: number; scale: number };

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;
// The SVG keeps a 1200x800 coordinate system for shared marker/action data;
// fit and clamp to the hand-drawn town bounds so phones see the whole town.
const ISOMETRIC_TOWN_BOUNDS = { x: 80, y: 20, width: 1000, height: 650 };
const ZOOM_LEVELS: MapZoomLevel[] = [1, 2, 3];
const typedMapData = mapData as typeof mapData;
const districts = typedMapData.districts as MapDistrict[];
const allLandmarks = districts.flatMap((district) => district.landmarks);
const allBuildings = districts.flatMap((district) => district.buildings ?? []);
const allTownProps = districts.flatMap((district) =>
  (district.props ?? []).map((prop) => ({ district, prop })),
);
const buildingsByLandmark = new Map(
  allBuildings.map((building) => [building.landmark_id, building]),
);

function getMapFitScale(width: number, height: number, mode: MapProjectionMode) {
  const bounds = getMapBounds(mode);
  return Math.min(width / bounds.width, height / bounds.height);
}

function getMapBounds(mode: MapProjectionMode) {
  return mode === "isometric"
    ? ISOMETRIC_TOWN_BOUNDS
    : { x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT };
}

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
} satisfies Record<MapLandmark["category"], typeof MapPin>;

function sentenceCase(label: string) {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1).toLowerCase();
}

const MemoizedMapBase = memo(function MemoizedMapBase({
  data,
  onSelectDistrict,
}: {
  data: typeof mapData;
  onSelectDistrict: (district: MapDistrict) => void;
}) {
  return <OsogboMapSvg data={data} showLandmarks={false} onDistrictSelect={onSelectDistrict} />;
});

function MarkerLayer({
  zoomLevel,
  activeFilter,
  playerLocation,
  eventChips,
  jobLandmarkIds = [],
  billboardMarkers = [],
  labelViewport,
  screenScale,
  viewMode,
  onSelectLandmark,
  onSelectBillboard,
}: {
  zoomLevel: MapZoomLevel;
  activeFilter: MapFilter;
  playerLocation?: MapPlayerLocation | null;
  eventChips: MapEventChip[];
  jobLandmarkIds: string[];
  billboardMarkers: MapBillboardMarker[];
  labelViewport: { width: number; height: number };
  screenScale: number;
  viewMode: MapProjectionMode;
  onSelectLandmark: (landmark: MapLandmark) => void;
  onSelectBillboard?: (campaignId: string) => void;
}) {
  const inverseScale = 1 / Math.max(screenScale, 0.01);
  const mapBounds = getMapBounds(viewMode);
  const centeredOffset = {
    x: labelViewport.width / 2 - (mapBounds.x + mapBounds.width / 2) * screenScale,
    y: labelViewport.height / 2 - (mapBounds.y + mapBounds.height / 2) * screenScale,
  };
  const filteredCategory: Record<string, MapLandmark["category"][]> = {
    food: ["food", "market"],
    health: ["health"],
    services: ["services", "junction"],
    worship: ["worship"],
    transport: ["transport"],
    sport: ["sport"],
  };
  const labels = useMemo(() => {
    if (screenScale <= 0) return new Map<string, ReturnType<typeof layoutCityLabels>[number]>();
    const anchors =
      zoomLevel === 1
        ? districts.map((district) => {
            const point = districtMapPoint(district, viewMode);
            const name = sentenceCase(district.name);
            return {
              id: `district-${district.id}`,
              text: name,
              anchor: {
                x: point.x * screenScale + centeredOffset.x,
                y: point.y * screenScale + centeredOffset.y,
              },
              priority: 10,
              width: Math.max(104, name.length * 7 + 20),
              height: 36,
            };
          })
        : allLandmarks.map((landmark) => {
            const point = landmarkPoint(landmark, viewMode);
            const name = buildingsByLandmark.get(landmark.id)?.short_name ?? landmark.label;
            return {
              id: landmark.id,
              text: sentenceCase(name),
              anchor: {
                x: point.x * screenScale + centeredOffset.x,
                y: point.y * screenScale + centeredOffset.y,
              },
              priority: landmark.category === "junction" ? 1 : 2,
            };
          });
    const buildingObstacles = allLandmarks.map((landmark) => {
      const point = landmarkPoint(landmark, viewMode);
      const building = buildingsByLandmark.get(landmark.id);
      const width = (building?.footprint.width ?? 1) * 34 * screenScale;
      const height = (building?.footprint.depth ?? 0.9) * 26 * screenScale;
      return {
        x: point.x * screenScale + centeredOffset.x - width / 2 - 5,
        y: point.y * screenScale + centeredOffset.y - height - 7,
        width: width + 10,
        height: height + 18,
      };
    });
    const propObstacles = allTownProps.map(({ district, prop }) => {
      const point = townPropPoint(district, prop, viewMode);
      const size =
        prop.kind === "tree" ? 20 : Math.max(prop.footprint.width, prop.footprint.depth) * 26;
      return {
        x: point.x * screenScale + centeredOffset.x - size * screenScale,
        y: point.y * screenScale + centeredOffset.y - size * screenScale,
        width: size * 2 * screenScale,
        height: size * 2 * screenScale,
      };
    });
    return new Map(
      layoutCityLabels(anchors, zoomLevel === 1 ? [] : [...buildingObstacles, ...propObstacles], {
        width: Math.min(VIEW_WIDTH * screenScale, labelViewport.width),
        height: Math.min(VIEW_HEIGHT * screenScale, labelViewport.height),
      }).map((placement) => [placement.id, placement]),
    );
  }, [centeredOffset.x, centeredOffset.y, labelViewport, screenScale, viewMode, zoomLevel]);

  return (
    <svg
      className="map-marker-layer"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      aria-label="Map markers"
      aria-hidden="false"
    >
      <g className="map-town-props" aria-hidden="true">
        {allTownProps.map(({ district, prop }) => (
          <TownProp key={prop.id} district={district} prop={prop} viewMode={viewMode} />
        ))}
      </g>

      <g className="map-landmark-markers" aria-label="Places">
        {allLandmarks.map((landmark) => {
          const matches =
            activeFilter === "all" ||
            (activeFilter === "jobs"
              ? jobLandmarkIds.includes(landmark.id)
              : (filteredCategory[activeFilter] ?? [activeFilter]).includes(landmark.category));
          const Icon = categoryIcons[landmark.category];
          const building = buildingsByLandmark.get(landmark.id) ?? fallbackBuilding(landmark);
          const position = landmarkPoint(landmark, viewMode);
          const activate = () => onSelectLandmark(landmark);
          return (
            <g
              key={landmark.id}
              className="map-canvas-marker"
              transform={`translate(${position.x} ${position.y})`}
              style={{ opacity: matches ? 1 : 0.35 }}
              data-map-interactive="true"
              data-landmark-id={landmark.id}
              data-building-category={landmark.category}
              role="button"
              tabIndex={0}
              aria-label={sentenceCase(landmark.label)}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
            >
              <BuildingArtwork building={building} label={landmark.label} />
              <g className="map-building-icon" transform={`scale(${inverseScale})`}>
                <rect className="map-marker-hit" x="-22" y="-48" width="44" height="44" rx="9" />
                <circle className="map-building-icon-disc" cy="-26" r="12" />
                <Icon
                  className="map-canvas-marker-icon"
                  x="-9"
                  y="-35"
                  width="18"
                  height="18"
                  aria-hidden="true"
                />
              </g>
            </g>
          );
        })}
      </g>

      {zoomLevel === 1 && (
        <g
          className="map-district-labels"
          aria-label="District names and traffic"
          aria-hidden="true"
        >
          {districts.map((district) => {
            const placement = labels.get(`district-${district.id}`);
            if (!placement) return null;
            const center = {
              x: (placement.center.x - centeredOffset.x) * inverseScale,
              y: (placement.center.y - centeredOffset.y) * inverseScale,
            };
            const width = placement.width;
            const height = placement.height;
            const trafficCount =
              district.traffic === "high" ? 3 : district.traffic === "medium" ? 2 : 1;
            return (
              <g
                key={district.id}
                className="map-district-overlay-label"
                data-district-label={district.id}
                transform={`translate(${center.x} ${center.y}) scale(${inverseScale})`}
              >
                <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="7" />
                <text className="district-overlay-name" textAnchor="middle" y="-5">
                  {sentenceCase(district.name)}
                </text>
                <text className="district-overlay-traffic" textAnchor="middle" y="9">
                  {district.traffic[0]!.toUpperCase() + district.traffic.slice(1)} traffic
                </text>
                {[0, 1, 2].map((bar) => (
                  <rect
                    key={bar}
                    className={
                      bar < trafficCount ? "district-traffic-bar is-active" : "district-traffic-bar"
                    }
                    x={width / 2 - 19 + bar * 6}
                    y="14"
                    width="4"
                    height={bar < trafficCount ? 6 : 3}
                    rx="1"
                  />
                ))}
              </g>
            );
          })}
        </g>
      )}

      {zoomLevel > 1 && (
        <g className="map-building-labels" aria-hidden="true">
          {allLandmarks.map((landmark) => {
            const placement = labels.get(landmark.id);
            if (!placement) return null;
            const anchor = landmarkPoint(landmark, viewMode);
            const center = {
              x: (placement.center.x - centeredOffset.x) * inverseScale,
              y: (placement.center.y - centeredOffset.y) * inverseScale,
            };
            const width = placement.width;
            const height = placement.height;
            const dx = anchor.x * screenScale - placement.center.x;
            const dy = anchor.y * screenScale - placement.center.y;
            return (
              <g
                key={landmark.id}
                className="map-building-label"
                transform={`translate(${center.x} ${center.y}) scale(${inverseScale})`}
              >
                <line
                  x1="0"
                  y1={height / 2}
                  x2={dx}
                  y2={dy}
                  className="map-building-label-leader"
                />
                <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="7" />
                <text textAnchor="middle" dominantBaseline="central">
                  {placement.lines.map((line, index) => (
                    <tspan
                      key={`${landmark.id}-${index}`}
                      x="0"
                      dy={index === 0 ? (1 - placement.lines.length) * 6 : 12}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      )}

      <g className="map-billboard-markers" aria-label="City billboards">
        {billboardMarkers.map((billboard) => {
          const landmark = allLandmarks.find(({ id }) => id === billboard.landmarkId);
          if (!landmark) return null;
          const point = landmarkPoint(landmark, viewMode);
          const label = billboard.advertiserName.trim();
          const shortLabel = label.length > 15 ? `${label.slice(0, 14)}…` : label;
          return (
            <g
              key={billboard.campaignId}
              className="map-billboard-marker"
              transform={`translate(${point.x} ${point.y})`}
              role="button"
              tabIndex={0}
              aria-label={`Billboard for ${label}${billboard.count > 1 ? `, ${billboard.count} active campaigns` : ""}`}
              data-map-interactive="true"
              data-billboard-id={billboard.campaignId}
              onClick={() => onSelectBillboard?.(billboard.campaignId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectBillboard?.(billboard.campaignId);
                }
              }}
            >
              <rect
                className="map-billboard-hit map-billboard-hit-area"
                x={-22 * inverseScale}
                y={-47 * inverseScale}
                width={44 * inverseScale}
                height={44 * inverseScale}
                rx="8"
              />
              <g transform={`scale(${inverseScale})`} className="map-billboard-sign">
                <rect
                  className="map-billboard-board"
                  x="-64"
                  y="-43"
                  width="128"
                  height="34"
                  rx="5"
                />
                <Megaphone
                  x={-56}
                  y={-36}
                  width={20}
                  height={20}
                  className="map-billboard-icon"
                  aria-hidden="true"
                />
                <text className="map-billboard-name" x="-31" y="-22">
                  {shortLabel}
                </text>
                {billboard.count > 1 && (
                  <g className="map-billboard-count" transform="translate(57 -41)">
                    <circle r="10" />
                    <text textAnchor="middle" dominantBaseline="central">
                      {billboard.count > 9 ? "9+" : billboard.count}
                    </text>
                  </g>
                )}
                <path className="map-billboard-pole" d="M0 -9V8M-11 9H11" />
              </g>
            </g>
          );
        })}
      </g>

      {zoomLevel === 3 && playerLocation && (
        <g
          className={`map-live-marker map-live-marker-${playerLocation.markerType ?? "player"}`}
          transform={`translate(${mapPointForMode(playerLocation, viewMode).x} ${mapPointForMode(playerLocation, viewMode).y})`}
          role="img"
          aria-label={sentenceCase(playerLocation.label ?? "Your location")}
        >
          <circle className="map-live-marker-pulse" r="22" />
          <circle className="map-live-marker-core" r="12" />
          <text className="map-live-marker-label" y="-28">
            {sentenceCase(playerLocation.label ?? "Your location")}
          </text>
          {playerLocation.activity && (
            <text className="map-live-marker-hint" y="38">
              {sentenceCase(playerLocation.activity)}
            </text>
          )}
        </g>
      )}

      {zoomLevel === 3 && eventChips.length > 0 && (
        <g className="map-event-chips" aria-label="Events">
          {eventChips.map((chip) => (
            <g
              key={chip.id}
              className="map-event-chip"
              transform={`translate(${mapPointForMode(chip, viewMode).x} ${mapPointForMode(chip, viewMode).y})`}
              role="img"
              aria-label={sentenceCase(chip.label)}
            >
              <rect x="-62" y="-15" width="124" height="30" rx="15" />
              <text textAnchor="middle" dominantBaseline="central">
                {sentenceCase(chip.label)}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function fallbackBuilding(landmark: MapLandmark): MapBuilding {
  return {
    id: `building-${landmark.id}`,
    landmark_id: landmark.id,
    name: landmark.label,
    category: landmark.category,
    position: landmark.isoCell ?? { col: 0, row: 0 },
    footprint: { width: 1, depth: 0.8 },
    facade_slot: "front",
    verify: Boolean(landmark.verify),
  };
}

function BuildingArtwork({ building, label }: { building: MapBuilding; label: string }) {
  const width = 29 * building.footprint.width;
  const depth = 23 * building.footprint.depth;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const tall = building.category === "worship" ? 23 : building.category === "services" ? 19 : 15;
  const top = -tall;
  const leftWall = `${-halfWidth},0 0,${halfDepth} 0,${top} ${-halfWidth},${top - halfDepth}`;
  const rightWall = `0,${halfDepth} ${halfWidth},0 ${halfWidth},${top} 0,${top - halfDepth}`;
  const roof = `${-halfWidth},${top - halfDepth} 0,${top - depth} ${halfWidth},${top - halfDepth} 0,${top}`;
  const isMosque = label.toLocaleLowerCase().includes("mosque");

  return (
    <g className={`map-building-art building-${building.category}`} aria-hidden="true">
      <polygon
        className="building-ground"
        points={`${-halfWidth - 6},2 0,${halfDepth + 6} ${halfWidth + 6},2 0,${-halfDepth - 4}`}
      />
      {building.category === "sport" ? (
        <g className="building-stadium">
          <polygon points={`${-halfWidth},0 0,${halfDepth} ${halfWidth},0 0,${-halfDepth}`} />
          <path
            d={`M${-halfWidth * 0.62} 0H${halfWidth * 0.62} M0 ${-halfDepth * 0.62}V${halfDepth * 0.62} M${-halfWidth * 0.62} ${-halfDepth * 0.42}H${halfWidth * 0.62}`}
          />
          <rect x="-3" y="-3" width="6" height="6" />
          <path className="stadium-stand" d={`M${-halfWidth} -2L0 ${-halfDepth} ${halfWidth} -2`} />
        </g>
      ) : building.category === "junction" ? (
        <g className="building-junction">
          <path d="M-17 0H17M0 -12V12" />
          <path className="junction-crossing" d="M-5 -3H5M-5 0H5M-5 3H5" />
          <circle cx="0" cy="-15" r="4" />
        </g>
      ) : (
        <>
          <polygon
            className="building-shadow building-left-wall"
            points={leftWall}
            transform="translate(2 4)"
          />
          <polygon
            className="building-shadow building-right-wall"
            points={rightWall}
            transform="translate(2 4)"
          />
          <polygon className="building-left-wall" points={leftWall} />
          <polygon className="building-right-wall" points={rightWall} />
          <polygon className="building-roof" points={roof} />
          {building.category === "market" && (
            <g className="building-market-stalls">
              {[-0.65, 0, 0.65].map((ratio, index) => (
                <g key={index} transform={`translate(${ratio * halfWidth} ${top - 2})`}>
                  <path d="M-6 0L0 -4L6 0V4H-6Z" />
                  <circle cx="-2" cy="2" r="1" />
                  <circle cx="2" cy="2" r="1" />
                </g>
              ))}
            </g>
          )}
          {building.category === "school" && (
            <g className="building-school-details">
              <path
                d={`M${halfWidth - 2} ${top - depth + 2}V${top - depth - 12}h12l-4 4 4 4h-12`}
              />
              <path d={`M${-halfWidth - 8} 4h9m-7 -4v8m5 -8v8`} />
            </g>
          )}
          {building.category === "health" && (
            <path
              className="building-medical-cross"
              d={`M-2 ${top + 4}h4v4h4v4h-4v4h-4v-4h-4v-4h4Z`}
            />
          )}
          {building.category === "worship" &&
            (isMosque ? (
              <g className="building-mosque-details">
                <ellipse cx="0" cy={top - depth + 3} rx="7" ry="5" />
                <path d={`M0 ${top - depth - 3}V${top - depth - 9}m-4 3h8`} />
                <rect x={halfWidth - 5} y={top - depth - 3} width="4" height="14" rx="1" />
              </g>
            ) : (
              <g className="building-church-details">
                <path d={`M${halfWidth - 7} ${top - depth + 3}V${top - depth - 16}h11v16`} />
                <path d={`M${halfWidth - 1.5} ${top - depth - 13}v8m-4 -4h8`} />
              </g>
            ))}
          {building.category === "food" && (
            <g className="building-food-details">
              {[-9, 0, 9].map((x) => (
                <g key={x} transform={`translate(${x} ${top - depth - 4})`}>
                  <path d="M-5 0L0 -5L5 0ZM0 0v8" />
                  <circle cx="0" cy="7" r="1.5" />
                </g>
              ))}
            </g>
          )}
          {building.category === "transport" && (
            <g className="building-transport-details">
              <path d={`M${-halfWidth - 5} ${top - 1}h${width + 10}l-4 -8h-${width + 2}Z`} />
              <path d={`M${-halfWidth + 2} ${top}v10m${width - 4} -10v10`} />
              <Bus x={-5} y={top + 1} width={10} height={10} />
            </g>
          )}
          {building.category === "services" && (
            <g className="building-services-details">
              <path
                d={`M${-halfWidth + 4} ${top + 4}v${tall - 5}m${width / 3} -${tall - 4}v${tall - 5}m${width / 3} -${tall - 4}v${tall - 5}`}
              />
              <path d={`M${-halfWidth + 2} ${top + 2}h${width - 4}`} />
            </g>
          )}
        </>
      )}
      <title>{sentenceCase(label)}</title>
    </g>
  );
}

function TownProp({
  district,
  prop,
  viewMode,
}: {
  district: MapDistrict;
  prop: MapTownProp;
  viewMode: MapProjectionMode;
}) {
  const point = townPropPoint(district, prop, viewMode);
  if (prop.kind === "tree") {
    return (
      <g className="town-prop town-prop-tree" transform={`translate(${point.x} ${point.y})`}>
        <ellipse cx="0" cy="0" rx="10" ry="4" className="prop-ground" />
        <path d="M-1 1v-10h2V1Z" className="prop-trunk" />
        <circle cx="0" cy="-12" r="7" className="prop-canopy" />
        <circle cx="-5" cy="-8" r="4" className="prop-canopy-light" />
        <circle cx="5" cy="-8" r="4" className="prop-canopy-light" />
      </g>
    );
  }
  const width = 17 * prop.footprint.width;
  const depth = 14 * prop.footprint.depth;
  return (
    <g
      className={`town-prop town-prop-${prop.kind}`}
      transform={`translate(${point.x} ${point.y})`}
    >
      <polygon
        className="prop-ground"
        points={`${-width},1 0,${depth / 2 + 2} ${width},1 0,${-depth / 2}`}
      />
      <polygon
        className="prop-wall"
        points={`${-width / 2},0 0,${depth / 2} 0,-8 ${-width / 2},${-8 - depth / 2}`}
      />
      <polygon
        className="prop-wall-side"
        points={`0,${depth / 2} ${width / 2},0 ${width / 2},-8 0,${-8 - depth / 2}`}
      />
      <polygon
        className="prop-roof"
        points={`${-width / 2 - 2},${-8 - depth / 2} 0,${-12 - depth} ${width / 2 + 2},${-8 - depth / 2} 0,-8`}
      />
    </g>
  );
}

function townPropPoint(district: MapDistrict, prop: MapTownProp, viewMode: MapProjectionMode) {
  return viewMode === "isometric"
    ? isoCellToScreen(prop.position)
    : isoCellTo2dViewBox(prop.position, district.id);
}

function districtMapPoint(district: MapDistrict, viewMode: MapProjectionMode): Point {
  if (viewMode === "isometric" && district.isoCells?.length) {
    const center = district.isoCells.reduce(
      (sum, cell) => ({ col: sum.col + cell.col, row: sum.row + cell.row }),
      { col: 0, row: 0 },
    );
    return isoCellToScreen({
      col: center.col / district.isoCells.length,
      row: center.row / district.isoCells.length,
    });
  }
  const center = districtPoint(district);
  if (district.landmarks.length) {
    center.x /= district.landmarks.length;
    center.y /= district.landmarks.length;
  }
  return center;
}

function landmarkPoint(landmark: MapLandmark, viewMode: MapProjectionMode) {
  const buildingPosition = buildingsByLandmark.get(landmark.id)?.position ?? landmark.isoCell;
  return viewMode === "isometric" && buildingPosition
    ? isoCellToScreen(buildingPosition)
    : { x: landmark.x, y: landmark.y };
}

function districtPoint(district: MapDistrict) {
  if (district.landmarks.length) {
    return district.landmarks.reduce(
      (point, landmark) => ({ x: point.x + landmark.x, y: point.y + landmark.y }),
      { x: 0, y: 0 },
    );
  }
  const bounds = district.shape.reduce(
    (box, [x, y]) => ({
      minX: Math.min(box.minX, x),
      maxX: Math.max(box.maxX, x),
      minY: Math.min(box.minY, y),
      maxY: Math.max(box.maxY, y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

function getDistance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function nearestZoomLevel(scale: number, fitScale: number): MapZoomLevel {
  return ZOOM_LEVELS.reduce(
    (nearest, level) =>
      Math.abs(scale - fitScale * level) < Math.abs(scale - fitScale * nearest) ? level : nearest,
    1,
  );
}

export function MapCanvas({
  onSelectDistrict,
  onSelectLandmark,
  activeFilter = "all",
  searchTarget = null,
  playerLocation = null,
  eventChips = [],
  jobLandmarkIds = [],
  billboardMarkers = [],
  onSelectBillboard,
}: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onSelectDistrict, onSelectLandmark, onSelectBillboard });
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const viewportSizeRef = useRef({ width: 0, height: 0, fitScale: 1 });
  const hasInitializedViewportRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  const pointerStartRef = useRef<MapPointerSample | null>(null);
  const pointerSequenceRef = useRef(false);
  const blockedClickRef = useRef(false);
  const gestureRef = useRef<{
    start: Point | undefined;
    startTransform: ViewTransform | undefined;
    pinchDistance: number | undefined;
    pinchMidpoint: Point | undefined;
    pinchMapPoint: Point | undefined;
    moved: boolean;
  }>({
    start: undefined,
    startTransform: undefined,
    pinchDistance: undefined,
    pinchMidpoint: undefined,
    pinchMapPoint: undefined,
    moved: false,
  });
  const pendingSelectionRef = useRef<(() => void) | null>(null);
  const reducedMotionRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState<MapZoomLevel>(1);
  const [screenScale, setScreenScale] = useState(1);
  const [labelViewport, setLabelViewport] = useState({ width: 1200, height: 800 });
  const [viewMode, setViewMode] = useState<MapProjectionMode>("isometric");

  callbacksRef.current = { onSelectDistrict, onSelectLandmark, onSelectBillboard };

  const clampTransform = useCallback(
    (transform: ViewTransform): ViewTransform => {
      const { width, height } = viewportSizeRef.current;
      const bounds = getMapBounds(viewMode);
      const mapWidth = bounds.width * transform.scale;
      const mapHeight = bounds.height * transform.scale;
      return {
        ...transform,
        x:
          mapWidth <= width
            ? width / 2 - (bounds.x + bounds.width / 2) * transform.scale
            : Math.max(
                width - (bounds.x + bounds.width) * transform.scale,
                Math.min(-bounds.x * transform.scale, transform.x),
              ),
        y:
          mapHeight <= height
            ? height / 2 - (bounds.y + bounds.height / 2) * transform.scale
            : Math.max(
                height - (bounds.y + bounds.height) * transform.scale,
                Math.min(-bounds.y * transform.scale, transform.y),
              ),
      };
    },
    [viewMode],
  );

  const applyTransform = useCallback(
    (transform: ViewTransform, animate: boolean) => {
      const clamped = clampTransform(transform);
      const previous = transformRef.current;
      transformRef.current = clamped;
      const element = mapRef.current;
      if (!element) return;
      element.classList.toggle("is-animated", animate && !reducedMotionRef.current);
      element.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0) scale(${clamped.scale})`;
      if (Math.abs(previous.scale - clamped.scale) > 0.001) setScreenScale(clamped.scale);
      const unchanged =
        Math.abs(previous.x - clamped.x) < 0.01 &&
        Math.abs(previous.y - clamped.y) < 0.01 &&
        Math.abs(previous.scale - clamped.scale) < 0.001;
      if (!animate || reducedMotionRef.current || unchanged) {
        const selection = pendingSelectionRef.current;
        pendingSelectionRef.current = null;
        selection?.();
      }
    },
    [clampTransform],
  );

  const centerOn = useCallback(
    (
      point: Point,
      animate: boolean,
      afterMove?: () => void,
      targetZoom: MapZoomLevel = zoomLevel,
    ) => {
      const { width, height, fitScale } = viewportSizeRef.current;
      const scale = fitScale * targetZoom;
      pendingSelectionRef.current = afterMove ?? null;
      applyTransform(
        {
          x: width / 2 - point.x * scale,
          y: height / 2 - point.y * scale,
          scale,
        },
        animate,
      );
    },
    [applyTransform, zoomLevel],
  );

  const changeZoomLevel = useCallback(
    (level: MapZoomLevel) => {
      const { width, height, fitScale } = viewportSizeRef.current;
      const current = transformRef.current;
      const center = {
        x: (width / 2 - current.x) / current.scale,
        y: (height / 2 - current.y) / current.scale,
      };
      setZoomLevel(level);
      applyTransform(
        {
          x: width / 2 - center.x * fitScale * level,
          y: height / 2 - center.y * fitScale * level,
          scale: fitScale * level,
        },
        true,
      );
    },
    [applyTransform],
  );

  const selectDistrict = useCallback(
    (district: MapDistrict) => {
      const center = districtPoint(district);
      if (district.landmarks.length) {
        center.x /= district.landmarks.length;
        center.y /= district.landmarks.length;
      }
      setZoomLevel(2);
      const projected = mapPointForMode(center, viewMode);
      centerOn(projected, true, () => callbacksRef.current.onSelectDistrict(district.id), 2);
    },
    [centerOn, viewMode],
  );

  const selectLandmark = useCallback((landmark: MapLandmark) => {
    callbacksRef.current.onSelectLandmark(landmark.id);
  }, []);

  const districtSelectRef = useRef(selectDistrict);
  districtSelectRef.current = selectDistrict;
  const stableDistrictSelect = useCallback(
    (district: MapDistrict) => districtSelectRef.current(district),
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      reducedMotionRef.current = query.matches;
      if (query.matches && mapRef.current) mapRef.current.classList.remove("is-animated");
    };
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setLabelViewport({ width, height });
      const fitScale = getMapFitScale(width, height, viewMode);
      viewportSizeRef.current = { width, height, fitScale };
      setScreenScale(fitScale * zoomLevel);
      const current = transformRef.current;
      const point =
        !hasInitializedViewportRef.current && !searchTarget
          ? (() => {
              const bounds = getMapBounds(viewMode);
              return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
            })()
          : {
              x: (width / 2 - current.x) / Math.max(current.scale, 0.001),
              y: (height / 2 - current.y) / Math.max(current.scale, 0.001),
            };
      hasInitializedViewportRef.current = true;
      const scale = fitScale * zoomLevel;
      applyTransform(
        { x: width / 2 - point.x * scale, y: height / 2 - point.y * scale, scale },
        false,
      );
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyTransform, searchTarget, viewMode, zoomLevel]);

  useEffect(() => {
    if (!searchTarget) return;
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    const kind = typeof searchTarget === "string" ? undefined : searchTarget.kind;
    const landmark = kind !== "district" ? allLandmarks.find((item) => item.id === id) : undefined;
    if (landmark) {
      setZoomLevel(2);
      const district = districts.find((item) =>
        item.landmarks.some(({ id: itemId }) => itemId === id),
      );
      centerOn(
        landmarkPoint(landmark, viewMode),
        true,
        () => callbacksRef.current.onSelectLandmark(landmark.id),
        2,
      );
      if (!district) return;
      return;
    }
    const district = kind !== "landmark" ? districts.find((item) => item.id === id) : undefined;
    if (district) {
      const center = districtPoint(district);
      setZoomLevel(2);
      centerOn(
        mapPointForMode(
          {
            x: district.landmarks.length ? center.x / district.landmarks.length : center.x,
            y: district.landmarks.length ? center.y / district.landmarks.length : center.y,
          },
          viewMode,
        ),
        true,
        () => callbacksRef.current.onSelectDistrict(district.id),
        2,
      );
    }
  }, [centerOn, searchTarget, viewMode]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = transformRef.current;
    const gesture = gestureRef.current;
    pointerSequenceRef.current = true;
    if (pointersRef.current.size === 1) {
      gesture.moved = false;
      blockedClickRef.current = false;
      pointerStartRef.current = { x: event.clientX, y: event.clientY, at: Date.now() };
      gesture.start = { x: event.clientX, y: event.clientY };
      gesture.startTransform = current;
    } else if (pointersRef.current.size === 2) {
      gesture.moved = true;
      blockedClickRef.current = true;
      pointerStartRef.current = null;
      const [first, second] = [...pointersRef.current.values()];
      if (!first || !second) return;
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      gesture.pinchDistance = getDistance(first, second);
      gesture.pinchMidpoint = midpoint;
      gesture.pinchMapPoint = {
        x:
          (midpoint.x - current.x - (viewportRef.current?.getBoundingClientRect().left ?? 0)) /
          current.scale,
        y:
          (midpoint.y - current.y - (viewportRef.current?.getBoundingClientRect().top ?? 0)) /
          current.scale,
      };
      gesture.startTransform = current;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    const viewportBounds = viewportRef.current?.getBoundingClientRect();
    if (
      pointersRef.current.size >= 2 &&
      gesture.pinchDistance &&
      gesture.startTransform &&
      viewportBounds
    ) {
      const [first, second] = [...pointersRef.current.values()];
      if (!first || !second) return;
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const nextScale = Math.max(
        viewportSizeRef.current.fitScale,
        Math.min(
          viewportSizeRef.current.fitScale * 3,
          (gesture.startTransform.scale * getDistance(first, second)) / gesture.pinchDistance,
        ),
      );
      const midpointLocal = {
        x: midpoint.x - viewportBounds.left,
        y: midpoint.y - viewportBounds.top,
      };
      const mapPoint = gesture.pinchMapPoint ?? { x: 0, y: 0 };
      applyTransform(
        {
          x: midpointLocal.x - mapPoint.x * nextScale,
          y: midpointLocal.y - mapPoint.y * nextScale,
          scale: nextScale,
        },
        false,
      );
      gesture.moved = true;
      return;
    }
    if (gesture.start && gesture.startTransform) {
      const dx = event.clientX - gesture.start.x;
      const dy = event.clientY - gesture.start.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
      gesture.moved = true;
      applyTransform(
        {
          ...gesture.startTransform,
          x: gesture.startTransform.x + dx,
          y: gesture.startTransform.y + dy,
        },
        false,
      );
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    const gesture = gestureRef.current;
    if (gesture.pinchDistance) {
      const current = transformRef.current;
      const nextLevel = nearestZoomLevel(current.scale, viewportSizeRef.current.fitScale);
      const bounds = viewportSizeRef.current;
      const centerPoint = {
        x: (bounds.width / 2 - current.x) / current.scale,
        y: (bounds.height / 2 - current.y) / current.scale,
      };
      setZoomLevel(nextLevel);
      applyTransform(
        {
          x: bounds.width / 2 - centerPoint.x * bounds.fitScale * nextLevel,
          y: bounds.height / 2 - centerPoint.y * bounds.fitScale * nextLevel,
          scale: bounds.fitScale * nextLevel,
        },
        true,
      );
      gesture.pinchDistance = undefined;
      gesture.pinchMidpoint = undefined;
      gesture.pinchMapPoint = undefined;
    }
    if (pointersRef.current.size === 1) {
      const [remainingPoint] = pointersRef.current.values();
      if (remainingPoint) {
        gesture.start = remainingPoint;
        gesture.startTransform = transformRef.current;
      }
    } else {
      gesture.start = undefined;
      gesture.startTransform = undefined;
    }
    if (pointersRef.current.size === 0) {
      const start = pointerStartRef.current;
      blockedClickRef.current =
        gesture.moved ||
        !start ||
        !isQuickMapTap(start, { x: event.clientX, y: event.clientY, at: Date.now() });
      pointerStartRef.current = null;
    }
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) {
      pointerSequenceRef.current = false;
      blockedClickRef.current = false;
      return;
    }
    if (pointerSequenceRef.current && blockedClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
    pointerSequenceRef.current = false;
    blockedClickRef.current = false;
  };

  const onTransformEnd = () => {
    const selection = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    selection?.();
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(".map-canvas-zoom-controls")) return;
    event.preventDefault();
    const nextLevel = Math.max(
      1,
      Math.min(3, zoomLevel + (event.deltaY < 0 ? 1 : -1)),
    ) as MapZoomLevel;
    if (nextLevel === zoomLevel) return;
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const current = transformRef.current;
    const focalPoint = {
      x: (event.clientX - bounds.left - current.x) / current.scale,
      y: (event.clientY - bounds.top - current.y) / current.scale,
    };
    const nextScale = viewportSizeRef.current.fitScale * nextLevel;
    setZoomLevel(nextLevel);
    applyTransform(
      {
        x: event.clientX - bounds.left - focalPoint.x * nextScale,
        y: event.clientY - bounds.top - focalPoint.y * nextScale,
        scale: nextScale,
      },
      true,
    );
  };

  const markerLayer = useMemo(
    () => (
      <MarkerLayer
        zoomLevel={zoomLevel}
        viewMode={viewMode}
        activeFilter={activeFilter}
        playerLocation={playerLocation}
        eventChips={eventChips}
        jobLandmarkIds={jobLandmarkIds}
        billboardMarkers={billboardMarkers}
        labelViewport={labelViewport}
        screenScale={screenScale}
        onSelectLandmark={selectLandmark}
        {...(onSelectBillboard ? { onSelectBillboard } : {})}
      />
    ),
    [
      activeFilter,
      eventChips,
      jobLandmarkIds,
      billboardMarkers,
      labelViewport,
      onSelectBillboard,
      playerLocation,
      screenScale,
      selectLandmark,
      viewMode,
      zoomLevel,
    ],
  );

  return (
    <div
      ref={viewportRef}
      className="map-canvas"
      data-zoom-level={zoomLevel}
      role="region"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onWheel={onWheel}
      onClickCapture={onClickCapture}
      onLostPointerCapture={finishPointer}
      aria-label="Interactive Osogbo map"
    >
      <div
        ref={mapRef}
        className="map-canvas-transform"
        onTransitionEnd={onTransformEnd}
        style={{ width: VIEW_WIDTH, height: VIEW_HEIGHT }}
      >
        {viewMode === "2d" ? (
          <MemoizedMapBase data={typedMapData} onSelectDistrict={stableDistrictSelect} />
        ) : (
          <IsometricMapSvg onSelectDistrict={stableDistrictSelect} />
        )}
        {markerLayer}
      </div>
      <div className="map-canvas-zoom-controls" role="group" aria-label="Map zoom level">
        {(["2d", "isometric"] as const).map((mode) => (
          <button
            className="map-canvas-zoom-button"
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setViewMode(mode)}
          >
            {mode === "2d" ? "2D" : "Isometric"}
          </button>
        ))}
        {ZOOM_LEVELS.map((level) => {
          const label = level === 1 ? "Overview" : level === 2 ? "Street" : "Detail";
          return (
            <button
              className="map-canvas-zoom-button"
              key={level}
              type="button"
              aria-pressed={zoomLevel === level}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => changeZoomLevel(level)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
