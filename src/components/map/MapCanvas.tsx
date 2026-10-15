import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type * as React from "react";
import { Html } from "@react-three/drei";
import {
  BusFront,
  Cloud,
  HeartPulse,
  Landmark,
  Megaphone,
  MapPin,
  School,
  ShoppingBasket,
  Trophy,
  Utensils,
} from "lucide-react";
import { Scene, preloadModels } from "@/components/3d/Scene";
import { Model } from "@/components/3d/Model";
import townData from "@/data/osogbo-town.json";
import { getSceneColor } from "@/lib/scene-colors";
import {
  expandTownGridLayout,
  mapTownGridToScene,
  isTownTap,
  type TownCellKind,
  type TownGridLayout,
} from "@/lib/town-grid";
import type { MapDistrict, MapLandmark } from "@/components/map/OsogboMap.svg";
import { layoutCityLabels } from "@/lib/city-label-layout";
import { Color, InstancedMesh, Object3D, type ColorRepresentation } from "three";
import { useThree } from "@react-three/fiber";
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
export type MapEventChip = { id: string; label: string; x: number; y: number };
export type MapBillboardMarker = {
  campaignId: string;
  landmarkId: string;
  advertiserName: string;
  title?: string;
  imageUrl?: string | null;
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

const gridLayout = townData.grid;
const grid = expandTownGridLayout(
  gridLayout as TownGridLayout,
  townData.meta.legend as Record<string, TownCellKind>,
);
const sceneCells = mapTownGridToScene(grid);
const cellByPlace = new Map(
  grid.cells.filter((cell) => cell.placeId).map((cell) => [cell.placeId!, cell]),
);
const rawLandmarks = townData.landmarks as Array<
  MapLandmark & {
    districtId: string;
    locationSlug: string;
    grid: { x: number; z: number };
    model: string;
    min_age?: number;
  }
>;
const districts = townData.districts.map((district) => ({
  ...district,
  landmarks: rawLandmarks.filter((landmark) => landmark.districtId === district.id),
})) as unknown as MapDistrict[];
const landmarks = rawLandmarks as (MapLandmark & {
  districtId: string;
  locationSlug: string;
  grid: { x: number; z: number };
  model: string;
  min_age?: number;
})[];
const modelPaths = [...new Set(landmarks.map(({ model }) => model))];
const sceneBounds = { minX: -14, maxX: 14, minZ: -10, maxZ: 10 };

const icons = {
  market: ShoppingBasket,
  transport: BusFront,
  school: School,
  health: HeartPulse,
  worship: Cloud,
  junction: MapPin,
  sport: Trophy,
  food: Utensils,
  services: Landmark,
} satisfies Record<MapLandmark["category"], typeof Landmark>;

const labelFor = (value: string) =>
  value.length ? value[0]!.toUpperCase() + value.slice(1) : value;

function TownInstances({
  cells,
  kind,
  color,
  height,
}: {
  cells: typeof sceneCells;
  kind: "grass" | "road" | "water" | "plot";
  color: ColorRepresentation;
  height: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const positions = useMemo(() => cells.filter((cell) => cell.kind === kind), [cells, kind]);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new Object3D();
    positions.forEach((cell, index) => {
      matrix.position.set(cell.x, cell.y + height / 2 - 0.08, cell.z);
      matrix.scale.set(grid.cellSize, height, grid.cellSize);
      matrix.updateMatrix();
      mesh.current!.setMatrixAt(index, matrix.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [height, invalidate, positions]);
  if (!positions.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={1} />
    </instancedMesh>
  );
}

const TownBase = memo(function TownBase() {
  const colors = useMemo(
    () => ({
      grass: getSceneColor("--scene-hill"),
      road: getSceneColor("--scene-road"),
      water: getSceneColor("--scene-sky"),
      plot: getSceneColor("--scene-wood"),
    }),
    [],
  );
  return (
    <group>
      <TownInstances cells={sceneCells} kind="grass" color={colors.grass} height={0.24} />
      <TownInstances cells={sceneCells} kind="road" color={colors.road} height={0.28} />
      <TownInstances cells={sceneCells} kind="water" color={colors.water} height={0.22} />
      <TownInstances cells={sceneCells} kind="plot" color={colors.plot} height={0.3} />
      <TownPropInstances kind="tree" />
      <TownPropInstances kind="car" />
    </group>
  );
});

function TownPropInstances({ kind }: { kind: "tree" | "car" }) {
  const first = useRef<InstancedMesh>(null);
  const second = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const positions = useMemo(
    () =>
      (kind === "tree" ? (townData.grid.treeCells ?? []) : (townData.grid.carCells ?? [])).map(
        ([x, z]) => mapTownGridToScene({ ...grid, cells: [{ x: x!, z: z!, kind: "grass" }] })[0]!,
      ),
    [kind],
  );
  useLayoutEffect(() => {
    const placeInstances = (
      mesh: React.RefObject<InstancedMesh | null>,
      offsetY: number,
      scale: [number, number, number],
    ) => {
      if (!mesh.current) return;
      const transform = new Object3D();
      positions.forEach((point, index) => {
        transform.position.set(point.x, offsetY, point.z);
        transform.scale.set(...scale);
        transform.updateMatrix();
        mesh.current!.setMatrixAt(index, transform.matrix);
        if (kind === "car")
          mesh.current!.setColorAt(
            index,
            new Color(
              index % 2 ? getSceneColor("--scene-accent") : getSceneColor("--scene-wood-line"),
            ),
          );
      });
      mesh.current.instanceMatrix.needsUpdate = true;
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    };
    if (kind === "tree") {
      placeInstances(first, 0.38, [0.2, 0.75, 0.2]);
      placeInstances(second, 1.15, [1.15, 1.5, 1.15]);
    } else {
      placeInstances(first, 0.16, [1.1, 0.3, 0.58]);
      placeInstances(second, 0.36, [0.56, 0.28, 0.5]);
    }
    invalidate();
  }, [invalidate, kind, positions]);
  if (!positions.length) return null;
  return kind === "tree" ? (
    <>
      <instancedMesh
        ref={first}
        args={[undefined, undefined, positions.length]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.1, 0.14, 1, 5]} />
        <meshStandardMaterial color={getSceneColor("--scene-wood")} />
      </instancedMesh>
      <instancedMesh
        ref={second}
        args={[undefined, undefined, positions.length]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.5, 1, 5]} />
        <meshStandardMaterial color={getSceneColor("--scene-hill-front")} />
      </instancedMesh>
    </>
  ) : (
    <>
      <instancedMesh
        ref={first}
        args={[undefined, undefined, positions.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="white" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={second}
        args={[undefined, undefined, positions.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="white" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

function PlaceModels() {
  return (
    <group>
      {landmarks.map((place) => {
        const cell = cellByPlace.get(place.id);
        if (!cell) return null;
        const point = mapTownGridToScene({ ...grid, cells: [cell] })[0]!;
        return (
          <group key={place.id} position={[point.x, 0.02, point.z]} scale={1.45}>
            <Model modelPath={place.model} />
          </group>
        );
      })}
    </group>
  );
}

const filterCategories: Record<string, string[]> = {
  jobs: [],
  food: ["food", "market"],
  health: ["health"],
  services: ["services"],
  worship: ["worship"],
  transport: ["transport"],
  sport: ["sport"],
};

function PlaceOverlays({
  zoom,
  filter,
  searchTarget,
  jobLandmarkIds,
  billboards,
  onSelectLandmark,
  onSelectDistrict,
  onSelectBillboard,
  tapAllowed,
}: {
  zoom: number;
  filter: MapFilter;
  searchTarget: MapSearchTarget | null;
  jobLandmarkIds: string[];
  billboards: MapBillboardMarker[];
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectBillboard?: (id: string) => void;
  tapAllowed: MutableRefObject<boolean>;
}) {
  const IconAnchor = ({ place }: { place: (typeof landmarks)[number] }) => {
    const cell = cellByPlace.get(place.id)!;
    const point = mapTownGridToScene({ ...grid, cells: [cell] })[0]!;
    const Icon = icons[place.category];
    const matches =
      filter === "all" ||
      (filter === "jobs"
        ? jobLandmarkIds.includes(place.id)
        : filterCategories[filter]?.includes(place.category));
    const isTarget =
      typeof searchTarget === "string" ? searchTarget === place.id : searchTarget?.id === place.id;
    return (
      <group key={place.id}>
        <Html
          position={[point.x, 3.1, point.z]}
          center
          distanceFactor={zoom * 0.5}
          zIndexRange={[20, 0]}
        >
          <button
            className={`town-place-bubble${isTarget ? " is-search-target" : ""}`}
            type="button"
            aria-label={`${labelFor(place.label)}${place.min_age ? ", 18 plus" : ""}`}
            style={{ opacity: matches ? 1 : 0.35 }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail === 0 || tapAllowed.current) onSelectLandmark(place.id);
            }}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        </Html>
        {zoom > 13 && (
          <Html
            position={[point.x, 2.35, point.z]}
            center
            distanceFactor={zoom * 0.5}
            zIndexRange={[15, 0]}
          >
            <button
              className="town-place-label"
              type="button"
              style={{ opacity: matches ? 1 : 0.35 }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (event.detail === 0 || tapAllowed.current) onSelectLandmark(place.id);
              }}
            >
              {labelFor(place.label)}
            </button>
          </Html>
        )}
        {billboards
          .filter((marker) => marker.landmarkId === place.id)
          .map((marker) => (
            <Html
              key={marker.campaignId}
              position={[point.x, 1.75, point.z + 0.9]}
              center
              distanceFactor={zoom * 0.5}
              zIndexRange={[10, 0]}
            >
              <button
                type="button"
                className="town-billboard"
                aria-label={`Billboard for ${marker.advertiserName}${marker.count > 1 ? `, ${marker.count} active campaigns` : ""}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail === 0 || tapAllowed.current)
                    onSelectBillboard?.(marker.campaignId);
                }}
              >
                {marker.imageUrl ? (
                  <img src={marker.imageUrl} alt="" loading="lazy" />
                ) : (
                  <Megaphone size={14} />
                )}{" "}
                {marker.title || marker.advertiserName}
                {marker.count > 1 ? ` +${marker.count - 1}` : ""}
              </button>
            </Html>
          ))}
      </group>
    );
  };

  const districtAnchors = useMemo(
    () =>
      districts.map((district) => {
        const area = (
          district as MapDistrict & {
            gridArea: { x: number; z: number; width: number; depth: number };
          }
        ).gridArea;
        const point = mapTownGridToScene({
          ...grid,
          cells: [
            { x: area.x + (area.width - 1) / 2, z: area.z + (area.depth - 1) / 2, kind: "grass" },
          ],
        })[0]!;
        return { district, point };
      }),
    [],
  );
  const labelPlacements = layoutCityLabels(
    districtAnchors.map(({ district }) => ({
      id: district.id,
      text: district.name,
      anchor: {
        x:
          Number(
            (
              district as MapDistrict & {
                gridArea: { x: number; z: number; width: number; depth: number };
              }
            ).gridArea.x,
          ) *
            72 +
          25,
        y:
          Number(
            (district as MapDistrict & { gridArea: { z: number; depth: number } }).gridArea.z,
          ) *
            68 +
          20,
      },
      priority: 4,
      width: 145,
      height: 34,
    })),
    [],
    { width: 1100, height: 760 },
  );
  const visibleLabelIds = new Set(labelPlacements.map((item) => item.id));
  return (
    <group>
      {districtAnchors.map(({ district, point }) => {
        if (!visibleLabelIds.has(district.id)) return null;
        return (
          <Html
            key={district.id}
            position={[point.x, 0.3, point.z]}
            center
            distanceFactor={zoom * 0.48}
            zIndexRange={[5, 0]}
          >
            <button
              className="town-district-label"
              type="button"
              aria-label={`${district.name} district, ${district.traffic} traffic`}
              onClick={(event) => {
                event.stopPropagation();
                if (event.detail === 0 || tapAllowed.current) onSelectDistrict(district.id);
              }}
            >
              {district.name}
              <small>{labelFor(district.traffic)} traffic</small>
            </button>
          </Html>
        );
      })}
      {landmarks.map((place) => (
        <IconAnchor key={place.id} place={place} />
      ))}
    </group>
  );
}

function IsometricTown({
  zoom,
  ...props
}: Omit<React.ComponentProps<typeof PlaceOverlays>, "zoom"> & { zoom: number }) {
  useEffect(() => {
    preloadModels(modelPaths);
  }, []);
  return (
    <Scene zoom={zoom} mapControls>
      <TownBase />
      <PlaceModels />
      <PlaceOverlays zoom={zoom} {...props} />
    </Scene>
  );
}

export function MapCanvas({
  onSelectDistrict,
  onSelectLandmark,
  activeFilter = "all",
  searchTarget = null,
  playerLocation: _playerLocation = null,
  eventChips: _eventChips = [],
  jobLandmarkIds = [],
  billboardMarkers = [],
  onSelectBillboard,
}: MapCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const tapAllowed = useRef(false);
  const [zoom, setZoom] = useState(18);
  const [zoomRange, setZoomRange] = useState({ min: 8, max: 54 });
  const callbacks = useRef({ onSelectDistrict, onSelectLandmark, onSelectBillboard });
  callbacks.current = { onSelectDistrict, onSelectLandmark, onSelectBillboard };

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const fit = Math.min(entry.contentRect.width / 30, entry.contentRect.height / 23);
      const min = Math.max(8, Math.min(20, fit));
      setZoomRange({ min, max: Math.max(min + 18, 54) });
      setZoom((current) =>
        current === 18
          ? Math.min(54, Math.max(min, fit * 1.08))
          : Math.min(54, Math.max(min, current)),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!searchTarget) return;
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    const found = landmarks.find((place) => place.id === id);
    if (found) {
      const cell = cellByPlace.get(found.id)!;
      const point = mapTownGridToScene({ ...grid, cells: [cell] })[0]!;
      window.dispatchEvent(
        new CustomEvent("osogbo:map-focus", { detail: { x: point.x, z: point.z } }),
      );
      callbacks.current.onSelectLandmark(id);
      return;
    }
    const district = districts.find((item) => item.id === id);
    if (district) callbacks.current.onSelectDistrict(id);
  }, [searchTarget]);

  const availablePlaces = useMemo(
    () =>
      landmarks.filter(
        (place) =>
          activeFilter === "all" ||
          (activeFilter === "jobs"
            ? jobLandmarkIds.includes(place.id)
            : (filterCategories[activeFilter] ?? [activeFilter]).includes(place.category)),
      ),
    [activeFilter, jobLandmarkIds],
  );
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    tapAllowed.current = false;
  }, []);
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStart.current)
      tapAllowed.current = isTownTap(pointerStart.current, {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
      });
    pointerStart.current = null;
  }, []);
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      pointerStart.current &&
      Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) >=
        6
    )
      tapAllowed.current = false;
  }, []);
  const adjustZoom = (delta: number) =>
    setZoom((value) => Math.max(zoomRange.min, Math.min(zoomRange.max, value + delta)));

  return (
    <div
      ref={rootRef}
      className="map-canvas town-map-canvas"
      role="region"
      aria-label="Interactive isometric town map"
      onPointerDownCapture={onPointerDown}
      onPointerMoveCapture={onPointerMove}
      onPointerUpCapture={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <IsometricTown
        zoom={zoom}
        filter={activeFilter}
        searchTarget={null}
        jobLandmarkIds={jobLandmarkIds}
        billboards={billboardMarkers}
        onSelectLandmark={(id) => callbacks.current.onSelectLandmark(id)}
        onSelectDistrict={(id) => callbacks.current.onSelectDistrict(id)}
        {...(onSelectBillboard
          ? { onSelectBillboard: (id: string) => callbacks.current.onSelectBillboard?.(id) }
          : {})}
        tapAllowed={tapAllowed}
      />
      <div className="town-map-zoom-controls" role="group" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" onClick={() => adjustZoom(3)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => adjustZoom(-3)}>
          −
        </button>
      </div>
      <ul className="town-map-accessible-list" aria-label="Places on the map">
        {availablePlaces.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => onSelectLandmark(place.id)}>
              {place.label}, {place.category}
            </button>
          </li>
        ))}
        {billboardMarkers.map((billboard) => (
          <li key={billboard.campaignId}>
            <button type="button" onClick={() => onSelectBillboard?.(billboard.campaignId)}>
              Billboard for {billboard.advertiserName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
