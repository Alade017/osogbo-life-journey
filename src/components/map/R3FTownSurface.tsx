import { MapPointerGesture } from "./map-pointer-gesture";
import { MapMarkerLayout } from "./MapMarkerLayout";
import { DistrictZones } from "./DistrictZones";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import town from "@/data/osogbo-town.json";
import {
  WorldBusStops,
  WorldRoadSigns,
  WorldMaterial,
  WorldTrees,
  type WorldTree,
  WorldInstances,
} from "../3d/WorldScene";
import { WORLD_SCALE, WORLD_PALETTE } from "../3d/world-theme";
import { TownBrandBillboards3D } from "./TownBrandBillboards3D";
import { HouseBlocks3D } from "./HouseBlocks3D";
import { townResidentialLayout } from "./town-residential-layout";
import { TownBuilding3D } from "./TownBuilding3D";
import { townBuildingProfile } from "./town-building-profile";
import { CompoundPlot3D } from "./CompoundPlot3D";
import { LandmarkItem3D } from "./LandmarkItem3D";
import { SelectionRing3D } from "./SelectionRing3D";
import { MapCameraRig } from "./MapCameraRig";
import { AtlasGround, AtlasPlaceModels } from "./OsogboAtlas";
import { LockedPlaces3D, type LockedSourcePlace } from "./LockedPlaces3D";
import { validateTownMapData } from "@/game/town-map-validation";

export type TownMapPlace = {
  id: string;
  label: string;
  category: string;
  grid: { x: number; z: number };
};

export type TownMapData = {
  places: readonly TownMapPlace[];
  /** Landmarks the player cannot visit yet; drawn as locked pins. */
  lockedPlaces?: readonly LockedSourcePlace[] | undefined;
  properties: readonly import("@/components/map/MapCanvas").MapProperty[] | undefined;
  playerLocation: import("@/components/map/MapCanvas").MapPlayerLocation | null | undefined;
  billboardMarkers: readonly import("@/components/map/MapCanvas").MapBillboardMarker[];
};

export type TownMapCallbacks = {
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectBillboard: ((campaignId: string) => void) | undefined;
};

type Props = TownMapData &
  TownMapCallbacks & {
    onSelectProperty?: (
      property: import("@/components/map/MapCanvas").MapProperty,
    ) => void | undefined;
    eventChips: readonly { id: string; label: string; x: number; y: number }[];
    onSelectEvent?: (landmarkId: string) => void | undefined;
    onReady: () => void;
    onUnavailable: () => void;
    searchTarget?: import("@/components/map/MapCanvas").MapSearchTarget | null | undefined;
    /** Frame the search target close up instead of the whole town (landing preview). */
    focusCloseUp?: boolean | undefined;
    selectedLandmarkId?: string | null | undefined;
    travelMode?: import("@/lib/transport-service").TravelMode | null | undefined;
    travelPending?: boolean | undefined;
    focusInsets?: import("./map-focus").MapFocusInsets | undefined;
  };

/** Close-up framing sits well inside the whole-town distance. */
const CLOSE_UP_DISTANCE_SCALE = 0.5;

const townMapValidationErrors = validateTownMapData(town);

const gridCols = town.meta.grid.columns;
const gridRows = town.meta.grid.rows;
const cell = WORLD_SCALE.townCell;
const point = (x: number, z: number): [number, number, number] => [
  (x - (gridCols - 1) / 2) * cell,
  0,
  (z - (gridRows - 1) / 2) * cell,
];
// A place's marker sits on the centre of its building (buildings span a 2x2 block of cells).
const placeAnchor = (place: {
  id: string;
  grid: { x: number; z: number };
}): [number, number, number] => {
  const building = town.grid.buildings.find((b) => b.placeId === place.id);
  return building ? point(building.x + 0.5, building.z + 0.5) : point(place.grid.x, place.grid.z);
};

class SurfaceBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    console.error("The town map renderer could not start.", error);
    this.props.onUnavailable();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export function R3FTownSurface(props: Props) {
  const { onUnavailable } = props;
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraReset, setCameraReset] = useState(0);
  const [followPlayer, setFollowPlayer] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    if (townMapValidationErrors.length > 0) onUnavailable();
  }, [onUnavailable]);
  const gesture = useRef(new MapPointerGesture());
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string;
    position: [number, number, number];
    type: "landmark" | "property" | "district" | "event";
  } | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  useEffect(() => {
    setCameraActive(true);
    if (selectedTarget) setFollowPlayer(false);
    else if (props.selectedLandmarkId === null) setCameraActive(false);
  }, [selectedTarget, props.selectedLandmarkId]);

  useEffect(() => {
    if (!props.searchTarget) return;
    const targetId =
      typeof props.searchTarget === "string" ? props.searchTarget : props.searchTarget.id;
    const landmark = props.places.find((p) => p.id === targetId);
    if (landmark) {
      const [x, , z] = placeAnchor(landmark);
      setSelectedTarget({ id: landmark.id, position: [x, 0, z], type: "landmark" });
      return;
    }
    const property = props.properties?.find((p) => p.id === targetId);
    if (property) {
      setSelectedTarget({ id: property.id, position: property.position, type: "property" });
      return;
    }
    const district = town.districts.find((d) => d.id === targetId);
    if (district) {
      const area = district.gridArea;
      const [x, , z] = point(area.x + area.width / 2, area.z + area.depth / 2);
      setSelectedTarget({ id: district.id, position: [x, 0, z], type: "district" });
    }
  }, [props.searchTarget, props.places, props.properties]);
  useEffect(() => {
    if (props.selectedLandmarkId === undefined) return;
    if (props.selectedLandmarkId === null) {
      setCameraActive(false);
      setSelectedTarget(null);
      return;
    }
    const landmark = town.landmarks.find((p) => p.id === props.selectedLandmarkId);
    if (!landmark) return;
    setSelectedTarget({
      id: landmark.id,
      position: placeAnchor(landmark),
      type: "landmark",
    });
  }, [props.selectedLandmarkId]);
  const closeUpTarget = props.focusCloseUp && selectedTarget ? selectedTarget.position : undefined;
  const busStops = useMemo<[number, number][]>(() => {
    const result: [number, number][] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        // Bus stops should sit beside roads, not on them.
        const neighbors = [
          { x, z: z - 1 },
          { x, z: z + 1 },
          { x: x - 1, z },
          { x: x + 1, z },
        ];

        const available = neighbors.find(({ x: nx, z: nz }) => {
          const neighborTile = rows[nz]?.[nx];
          if (neighborTile !== "g") return false;

          // Keep stops away from intersections and car positions.
          const adjacentRoads = [
            rows[nz - 1]?.[nx],
            rows[nz + 1]?.[nx],
            rows[nz]?.[nx - 1],
            rows[nz]?.[nx + 1],
          ].filter((value) => value === "r").length;

          if (adjacentRoads !== 1) return false;

          const occupiedByCar = town.grid.carCells.some(
            ([carX, carZ]) => carX === nx && carZ === nz,
          );

          return !occupiedByCar;
        });

        if (!available) return;

        const p = point(available.x, available.z);
        result.push([p[0], p[2]]);
      });
    });

    // Keep only two stops, spaced apart.
    return result.filter((_, index) => index % 4 === 0).slice(0, 2);
  }, []);
  const roadSigns = useMemo(() => {
    const candidates: [number, number][] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        const neighbors = [
          { x, z: z - 1 },
          { x, z: z + 1 },
          { x: x - 1, z },
          { x: x + 1, z },
        ];

        const available = neighbors.find(({ x: nx, z: nz }) => {
          if (rows[nz]?.[nx] !== "g") return false;

          const roadCount = [
            rows[nz - 1]?.[nx],
            rows[nz + 1]?.[nx],
            rows[nz]?.[nx - 1],
            rows[nz]?.[nx + 1],
          ].filter((value) => value === "r").length;

          if (roadCount !== 1) return false;

          return !town.grid.carCells.some(([carX, carZ]) => carX === nx && carZ === nz);
        });

        if (!available) return;

        const p = point(available.x, available.z);

        const nearBusStop = busStops.some(
          ([busX, busZ]) => Math.hypot(p[0] - busX, p[2] - busZ) < cell * 2,
        );

        if (!nearBusStop) {
          candidates.push([p[0], p[2]]);
        }
      });
    });

    const destinations = [
      { destination: "Osun Mall", direction: "right" as const },
      { destination: "Cedar Bank", direction: "left" as const },
      { destination: "Meridian Bank", direction: "right" as const },
    ];

    return candidates
      .filter((_, index) => index % 6 === 0)
      .slice(0, 3)
      .map(([x, z], index) => ({
        position: [x, z] as [number, number],
        ...destinations[index]!,
      }));
  }, [busStops]);
  const trees = useMemo<WorldTree[]>(() => {
    const occupied = new Set<string>();

    // Reserve building locations.
    town.grid.buildings.forEach((building) => {
      occupied.add(`${building.x},${building.z}`);
      occupied.add(`${building.x + 1},${building.z}`);
      occupied.add(`${building.x},${building.z + 1}`);
      occupied.add(`${building.x + 1},${building.z + 1}`);
    });

    // Reserve water and road locations.
    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    const result: WorldTree[] = [];

    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "g") return;
        if (occupied.has(`${x},${z}`)) return;

        // Deterministic variation without random changes on every render.
        const seed = (x * 17 + z * 31) % 100;

        // Avoid overly dense vegetation.
        if (seed > 38) return;

        result.push({
          position: [point(x + 0.5, z + 0.5)[0], point(x + 0.5, z + 0.5)[2]],
          height: 0.85 + (seed % 30) / 100,
          canopyScale: 0.85 + (seed % 35) / 100,
        });
      });
    });

    return result;
  }, []);
  const residentialHomes = useMemo(
    () =>
      townResidentialLayout({
        rows: town.grid.rows,
        buildings: town.grid.buildings,
        landmarks: town.landmarks,
        districts: town.districts,
        reservedCells: town.grid.plotCells,
        cell,
        reserved: [
          ...trees.map((tree) => tree.position),
          ...busStops,
          ...roadSigns.map((sign) => sign.position),
          ...(props.properties ?? []).map(
            (property) => [property.position[0], property.position[2]] as [number, number],
          ),
        ],
      }),
    [trees, busStops, roadSigns, props.properties],
  );
  const select = (event: ThreeEvent<MouseEvent> | undefined, action: () => void) => {
    event?.stopPropagation();
    if ((event?.delta ?? 0) <= 5 && !gesture.current.moved) action();
  };
  if (townMapValidationErrors.length > 0) {
    return (
      <div role="alert" className="town-map-renderer-status">
        The authored town map has invalid data: {townMapValidationErrors.join(" ")}
      </div>
    );
  }
  return (
    <SurfaceBoundary onUnavailable={props.onUnavailable}>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        onPointerDownCapture={(event) =>
          gesture.current.down(event.pointerId, event.clientX, event.clientY)
        }
        onPointerMoveCapture={(event) => gesture.current.move(event.clientX, event.clientY)}
        onPointerUpCapture={(event) => gesture.current.up(event.pointerId)}
        onPointerCancelCapture={(event) => gesture.current.cancel(event.pointerId)}
        onKeyDownCapture={(event) => {
          if (event.key === "Enter" || event.key === " ") gesture.current.keyboard();
        }}
      >
        <div className="town-camera-tools" role="toolbar" aria-label="3D town camera">
          <button
            type="button"
            onClick={() => {
              setSelectedTarget(null);
              setFollowPlayer(false);
              setCameraReset((value) => value + 1);
              setCameraActive(true);
            }}
          >
            Centre city
          </button>
          <button
            type="button"
            disabled={!props.playerLocation}
            aria-pressed={followPlayer}
            onClick={() => {
              setFollowPlayer((value) => !value);
              setCameraActive(true);
            }}
          >
            My location
          </button>
          <button
            type="button"
            aria-label="Show destination and district names"
            aria-pressed={showNames}
            onClick={() => setShowNames((value) => !value)}
          >
            Names
          </button>
        </div>
        <Canvas
          orthographic

          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          fallback={<span>WebGL is unavailable. Use the accessible map controls.</span>}
        >
          <MapMarkerLayout>
            <Ready onReady={props.onReady} />
            <MapCameraRig
              key={cameraReset}
              width={gridCols * cell}
              depth={gridRows * cell}
              target={
                followPlayer && props.playerLocation
                  ? point(props.playerLocation.x, props.playerLocation.y)
                  : (selectedTarget?.position ?? closeUpTarget ?? [0, 0, 0])
              }
              zoom={
                closeUpTarget ? 1 / CLOSE_UP_DISTANCE_SCALE : props.selectedLandmarkId ? 2.4 : 1.1
              }
              focusInsets={props.selectedLandmarkId ? props.focusInsets : undefined}
              active={cameraActive}
              onManual={() => {
                setCameraActive(false);
                setFollowPlayer(false);
              }}
            />
            <color attach="background" args={["#c2dce7"]} />
            <hemisphereLight args={["#fff5df", "#afc4ad", 1.7]} />
            <directionalLight position={[18, 32, 12]} intensity={1.8} />
            {/* Fixed-angle maps need clear visibility across the full authored city. */}
            <AtlasGround width={gridCols * cell} depth={gridRows * cell} />
            <AtlasPlaceModels places={props.places} point={point} cell={cell} />

            <WorldBusStops
              positions={busStops}
              size={cell}
              onSelectTransit={() => props.onSelectLandmark("transit-park")}
            />
            <WorldRoadSigns positions={roadSigns.slice(2)} size={cell} />
            <TownBrandBillboards3D positions={roadSigns} cell={cell} />
            <WorldInstances
              tone="wall"
              castShadow={false}
              items={town.grid.plotCells.map(([x, z]) => ({
                position: [point(x!, z!)[0], 0.015, point(x!, z!)[2]],
                scale: [cell, 0.03, cell],
              }))}
            />
            <WorldTrees positions={trees} />
            <HouseBlocks3D homes={residentialHomes} point={point} cell={cell} />
            {town.grid.buildings.map((building) => (
              <TownBuilding3D
                key={`building-${building.x}-${building.z}`}
                building={building}
                position={point(building.x + 0.5, building.z + 0.5)}
                cell={cell}
              />
            ))}
            <LockedPlaces3D
              places={props.lockedPlaces ?? []}
              cellSize={cell}
              gridCols={gridCols}
              gridRows={gridRows}
              onSelectLocked={(locked) => {
                setSelectedTarget({ id: locked.id, position: locked.position, type: "landmark" });
              }}
            />
            <DistrictZones
              showLabels={showNames}
              districts={town.districts}
              point={point}
              cell={cell}
              onSelect={(id, event) =>
                select(event, () => {
                  const district = town.districts.find((d) => d.id === id);
                  if (district) {
                    const area = district.gridArea;
                    const [x, , z] = point(area.x + area.width / 2, area.z + area.depth / 2);
                    setSelectedTarget({ id, position: [x, 0, z], type: "district" });
                  }
                  props.onSelectDistrict(id);
                })
              }
            />
            {selectedTarget && (
              <SelectionRing3D
                position={selectedTarget.position}
                color={selectedTarget.type === "property" ? "#10b981" : "#38bdf8"}
                radius={cell * 0.75}
              />
            )}
            {props.places.map((place) => {
              const [x, , z] = placeAnchor(place);
              const buildingType =
                town.grid.buildings.find((building) => building.placeId === place.id)
                  ?.buildingType ?? place.category;
              const markerCategory = buildingType === "bank" ? "bank" : place.category;
              const markerHeight = Math.max(
                3.8,
                townBuildingProfile(buildingType, place.grid.x, place.grid.z, cell).height + 0.5,
              );

              return (
                <LandmarkItem3D
                  key={place.id}
                  place={{ ...place, category: markerCategory }}
                  position={[x, markerHeight, z]}
                  isSelected={selectedTarget?.id === place.id}
                  isHovered={hoveredTargetId === place.id}
                  showName={showNames}
                  onSelectLandmark={(id) =>
                    select(undefined, () => {
                      setSelectedTarget({
                        id,
                        position: [x, 0, z],
                        type: "landmark",
                      });
                      props.onSelectLandmark(id);
                    })
                  }
                  onPointerOver={(id, lbl) => {
                    setHoveredTargetId(id);
                    setHovered(lbl);
                  }}
                  onPointerOut={() => {
                    setHoveredTargetId(null);
                    setHovered(null);
                  }}
                />
              );
            })}
            {props.eventChips.map((event) => {
              const p = point(event.x, event.y);
              return (
                <group
                  key={event.id}
                  name={"event:" + event.id}
                  onPointerOver={(pointer) => {
                    pointer.stopPropagation();
                    setHovered("Live event · " + event.label);
                  }}
                  onPointerOut={() => setHovered(null)}
                  onClick={(pointer) => select(pointer, () => props.onSelectEvent?.(event.id))}
                >
                  <mesh position={[p[0], 2.5, p[2]]} castShadow>
                    <sphereGeometry args={[0.24, 12, 12]} />
                    <WorldMaterial tone="clay" />
                  </mesh>
                </group>
              );
            })}
            {props.properties?.map((property) => (
              <CompoundPlot3D
                key={property.id}
                property={property}
                cellSize={cell}
                isNight={false}
                isSelected={selectedTarget?.id === property.id}
                isHovered={hoveredTargetId === property.id}
                onClick={(event) =>
                  select(event, () => {
                    setSelectedTarget({
                      id: property.id,
                      position: property.position,
                      type: "property",
                    });
                    props.onSelectProperty?.(property);
                  })
                }
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHoveredTargetId(property.id);
                  setHovered(
                    (property.label ?? "Home") + " · " + property.status.replace("_", " "),
                  );
                }}
                onPointerOut={() => {
                  setHoveredTargetId(null);
                  setHovered(null);
                }}
              />
            ))}
            {props.billboardMarkers.map((marker) => {
              const place = props.places.find((p) => p.id === marker.landmarkId);
              if (!place) return null;
              const p = point(place.grid.x, place.grid.z);
              return (
                <mesh
                  key={marker.campaignId}
                  position={[p[0] + 1.9, 2, p[2]]}
                  castShadow
                  onClick={(event) =>
                    select(event, () => props.onSelectBillboard?.(marker.campaignId))
                  }
                >
                  <boxGeometry args={[1.2, 1.5, 0.18]} />
                  <WorldMaterial tone="slate" />
                </mesh>
              );
            })}
            {props.playerLocation && (
              <SelectionRing3D
                position={point(props.playerLocation.x, props.playerLocation.y)}
                color="#084faf"
                radius={cell * 0.38}
              />
            )}
          </MapMarkerLayout>
        </Canvas>
        <div
          aria-label="Map camera controls"
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            pointerEvents: "none",
            color: WORLD_PALETTE.timber,
            background: "rgba(241, 233, 217, 0.92)",
            border: "1px solid rgba(130, 112, 93, 0.28)",
            padding: "7px 10px",
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.45,
            maxWidth: 230,
          }}
        >
          Drag to move · Pinch to zoom · Zoom in for more places
        </div>
        {hovered && (
          <div
            role="status"
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              pointerEvents: "none",
              color: WORLD_PALETTE.timber,
              background: WORLD_PALETTE.linen,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {hovered}
          </div>
        )}
      </div>
    </SurfaceBoundary>
  );
}
