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
} from "lucide-react";
import mapData from "@/data/osogbo-map.json";
import { OsogboMapSvg, type MapDistrict, type MapLandmark } from "@/components/map/OsogboMap.svg";
import { IsometricMapSvg } from "@/components/map/IsometricMap.svg";
import { isoCellToScreen, mapPointForMode, type MapProjectionMode } from "@/lib/map-projection";
import { isQuickMapTap, type MapPointerSample } from "@/lib/map-gesture";
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
const ZOOM_LEVELS: MapZoomLevel[] = [1, 2, 3];
const typedMapData = mapData as typeof mapData;
const districts = typedMapData.districts as MapDistrict[];
const allLandmarks = districts.flatMap((district) => district.landmarks);

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
  screenScale: number;
  viewMode: MapProjectionMode;
  onSelectLandmark: (landmark: MapLandmark) => void;
  onSelectBillboard?: (campaignId: string) => void;
}) {
  const hitSize = Math.max(44 / Math.max(screenScale, 0.01), 24);
  const hitOffset = hitSize / 2;
  const filteredCategory: Record<string, MapLandmark["category"][]> = {
    food: ["food", "market"],
    health: ["health"],
    services: ["services", "junction"],
    worship: ["worship"],
    transport: ["transport"],
    sport: ["sport"],
  };

  return (
    <svg
      className="map-marker-layer"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      aria-label="Map markers"
      aria-hidden="false"
    >
      {zoomLevel > 1 && (
        <g className="map-landmark-markers" aria-label="Landmarks">
          {allLandmarks.map((landmark) => {
            const matches =
              activeFilter === "all" ||
              (activeFilter === "jobs"
                ? jobLandmarkIds.includes(landmark.id)
                : (filteredCategory[activeFilter] ?? [activeFilter]).includes(landmark.category));
            const Icon = categoryIcons[landmark.category];
            const activate = () => onSelectLandmark(landmark);
            const position = landmarkPoint(landmark, viewMode);
            return (
              <g
                key={landmark.id}
                className="map-canvas-marker"
                style={{ opacity: matches ? 1 : 0.35 }}
                data-map-interactive="true"
                data-landmark-id={landmark.id}
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
                <rect
                  className="map-marker-hit"
                  x={position.x - hitOffset}
                  y={position.y - hitOffset}
                  width={hitSize}
                  height={hitSize}
                  rx="8"
                />
                <circle className="map-canvas-marker-dot" cx={position.x} cy={position.y} r="15" />
                <Icon
                  className="map-canvas-marker-icon"
                  x={position.x - 12}
                  y={position.y - 12}
                  width={24}
                  height={24}
                  aria-hidden="true"
                />
                <text className="map-canvas-marker-label" x={position.x} y={position.y + 32}>
                  {sentenceCase(landmark.label)}
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
          const inverseScale = 1 / Math.max(screenScale, 0.01);
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

function landmarkPoint(landmark: MapLandmark, viewMode: MapProjectionMode) {
  return viewMode === "isometric" && landmark.isoCell
    ? isoCellToScreen(landmark.isoCell)
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
  const [viewMode, setViewMode] = useState<MapProjectionMode>("2d");

  callbacksRef.current = { onSelectDistrict, onSelectLandmark, onSelectBillboard };

  const clampTransform = useCallback((transform: ViewTransform): ViewTransform => {
    const { width, height } = viewportSizeRef.current;
    const mapWidth = VIEW_WIDTH * transform.scale;
    const mapHeight = VIEW_HEIGHT * transform.scale;
    return {
      ...transform,
      x:
        mapWidth <= width
          ? (width - mapWidth) / 2
          : Math.max(width - mapWidth, Math.min(0, transform.x)),
      y:
        mapHeight <= height
          ? (height - mapHeight) / 2
          : Math.max(height - mapHeight, Math.min(0, transform.y)),
    };
  }, []);

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
      const fitScale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
      viewportSizeRef.current = { width, height, fitScale };
      setScreenScale(fitScale * zoomLevel);
      const current = transformRef.current;
      const point = {
        x: (width / 2 - current.x) / Math.max(current.scale, 0.001),
        y: (height / 2 - current.y) / Math.max(current.scale, 0.001),
      };
      const scale = fitScale * zoomLevel;
      applyTransform(
        { x: width / 2 - point.x * scale, y: height / 2 - point.y * scale, scale },
        false,
      );
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyTransform, zoomLevel]);

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
