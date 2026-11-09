import { DistrictZones } from "./DistrictZones";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import town from "@/data/osogbo-town.json";
import type { PhaserMapData, PhaserMapCallbacks } from "./PhaserMapSurface";
import {
  WorldCamera,
  WorldCars,
  WorldBusStops,
  WorldRoadSigns,
  WorldRoadsideShops,
  WorldMotorcycles,
  WorldTricycles,
  WorldStreetVendors,
  WorldHouse,
  WorldMaterial,
  WorldPeople,
  WorldRoads,
  WorldRoadMarkings,
  WorldPedestrianCrossings,
  WorldTrafficLights,
  WorldStreetLights,
  WorldWasteBins,
  WorldSidewalks,
  WorldTrees,
  type WorldTree,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { WORLD_SCALE, WORLD_PALETTE } from "../3d/world-theme";
import { MapLighting, useRealOrGameClock, daylightFor } from "./MapLighting";
import { getLandmarkBuildingVariant } from "./landmark-building-variant";
import { CompoundPlot3D } from "./CompoundPlot3D";
import { LandmarkItem3D } from "./LandmarkItem3D";
import { SelectionRing3D } from "./SelectionRing3D";
import { Terrain3D } from "./Terrain3D";
import { MovingTraffic3D } from "./MovingTraffic3D";
import { MovingPedestrians3D } from "./MovingPedestrians3D";
import { FunctionalStreetLights3D } from "./FunctionalStreetLights3D";
import { RoadsideInfrastructure3D } from "./RoadsideInfrastructure3D";
import { isMapTargetSelectionAllowed } from "@/game/map-gesture";
import { deriveTownMobilityRoutes, deriveTownPedestrianRoutes } from "@/game/town-mobility";

type Props = PhaserMapData &
  PhaserMapCallbacks & {
    onSelectProperty?: (property: import("@/components/map/MapCanvas").MapProperty) => void;
    selectedPropertyId?: string | null;
    eventChips: readonly { id: string; label: string; x: number; y: number }[];
    onSelectEvent?: (landmarkId: string) => void;
    onReady: () => void;
    onUnavailable: () => void;
    searchTarget?: import("@/components/map/MapCanvas").MapSearchTarget | null;
  };

const gridCols = Math.max(0, ...town.grid.rows.map((row) => row.length));
const gridRows = town.grid.rows.length;
const cell = WORLD_SCALE.townCell;
const point = (x: number, z: number): [number, number, number] => [
  (x - (gridCols - 1) / 2) * cell,
  0,
  (z - (gridRows - 1) / 2) * cell,
];

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

type Landmark = PhaserMapData["places"][number];

type BadgePosition = [number, number, number];

function calculateBadgePositions(
  places: readonly Landmark[],
  point: (x: number, z: number) => [number, number, number],
  cellSize: number,
): Map<string, BadgePosition> {
  const positions = places.map((place, index) => {
    const [x, , z] = point(place.grid.x, place.grid.z);

    return {
      id: place.id,
      x,
      z,
      originalX: x,
      originalZ: z,
      index,
    };
  });

  const minDistance = cellSize * 1.65;
  const maxOffset = cellSize * 2.5;

  for (let iteration = 0; iteration < 24; iteration++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];

        // Protect against possibly undefined array elements.
        if (!a || !b) continue;

        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let distance = Math.hypot(dx, dz);

        if (distance < 0.001) {
          const angle = ((a.index + b.index + 1) * Math.PI) / 5;
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          distance = 1;
        }

        if (distance >= minDistance) continue;

        const force = (minDistance - distance) * 0.18;
        const nx = dx / distance;
        const nz = dz / distance;

        a.x -= nx * force;
        a.z -= nz * force;

        b.x += nx * force;
        b.z += nz * force;
      }
    }

    for (const item of positions) {
      const dx = item.x - item.originalX;
      const dz = item.z - item.originalZ;
      const offset = Math.hypot(dx, dz);

      if (offset > maxOffset) {
        const scale = maxOffset / offset;

        item.x = item.originalX + dx * scale;
        item.z = item.originalZ + dz * scale;
      }
    }
  }

  return new Map(positions.map((item) => [item.id, [item.x, 1.8, item.z] as BadgePosition]));
}

export function R3FTownSurface(props: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  const clockTime = useRealOrGameClock();
  const { isNight } = daylightFor(clockTime.hour, clockTime.minute);
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string;
    position: [number, number, number];
    type: "landmark" | "property" | "district" | "event";
  } | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTarget) return;
    const propertyRemoved =
      selectedTarget.type === "property" &&
      props.properties !== undefined &&
      !props.properties.some((property) => property.id === selectedTarget.id);
    const landmarkFiltered =
      selectedTarget.type === "landmark" &&
      town.landmarks.some((landmark) => landmark.id === selectedTarget.id) &&
      !props.places.some((place) => place.id === selectedTarget.id);
    const eventRemoved =
      selectedTarget.type === "event" &&
      !props.eventChips.some((event) => event.id === selectedTarget.id);
    if (propertyRemoved || landmarkFiltered || eventRemoved) {
      setSelectedTarget(null);
    }
  }, [props.eventChips, props.places, props.properties, selectedTarget]);

  useEffect(() => {
    if (!props.searchTarget) return;
    const targetId = typeof props.searchTarget === "string" ? props.searchTarget : props.searchTarget.id;
    const targetKind = typeof props.searchTarget === "string" ? undefined : props.searchTarget.kind;
    if (targetKind !== "district") {
      const landmark = props.places.find((p) => p.id === targetId);
      if (landmark) {
        const [x, , z] = point(landmark.grid.x, landmark.grid.z);
        setSelectedTarget({ id: landmark.id, position: [x, 0, z], type: "landmark" });
        return;
      }
      const property = props.properties?.find((p) => p.id === targetId);
      if (property) {
        setSelectedTarget({ id: property.id, position: property.position, type: "property" });
        return;
      }
    }
    if (targetKind !== "landmark") {
      const district = town.districts.find((d) => d.id === targetId);
      if (district) {
        const area = district.gridArea;
        const [x, , z] = point(area.x + area.width / 2, area.z + area.depth / 2);
        setSelectedTarget({ id: district.id, position: [x, 0, z], type: "district" });
        return;
      }
    }

    // A stale search result must not leave the previous destination focused.
    setSelectedTarget(null);
  }, [props.searchTarget, props.places, props.properties]);
  const trafficRoutes = useMemo(
    () => deriveTownMobilityRoutes(town.grid.rows, cell, cell * 0.16),
    [],
  );
  const pedestrianRoutes = useMemo(() => {
    const buildingCells = town.grid.buildings.flatMap((building) =>
      [0, 1].flatMap((dx) => [0, 1].map((dz) => [building.x + dx, building.z + dz] as const)),
    );
    const blockedCells = [
      ...buildingCells,
      ...town.grid.waterCells,
      ...town.grid.plotCells,
    ];
    return deriveTownPedestrianRoutes(town.grid.rows, cell, blockedCells);
  }, []);
  const roads = useMemo(
    () =>
      town.grid.rows.flatMap((row, z) =>
        Array.from(row).flatMap((tile, x): WorldInstance[] =>
          tile === "r"
            ? [{ position: [point(x, z)[0], 0.03, point(x, z)[2]], scale: [cell, 0.06, cell] }]
            : [],
        ),
      ),
    [],
  );
  const roadMarkings = useMemo<WorldInstance[]>(() => {
    const result: WorldInstance[] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        // Avoid placing markings beneath parked cars.
        const occupiedByCar = town.grid.carCells.some(([carX, carZ]) => carX === x && carZ === z);

        if (occupiedByCar) return;

        const left = rows[z]?.[x - 1] === "r";
        const right = rows[z]?.[x + 1] === "r";
        const up = rows[z - 1]?.[x] === "r";
        const down = rows[z + 1]?.[x] === "r";

        const horizontal = left && right;
        const vertical = up && down;

        // Skip intersections, corners and road endpoints.
        if (horizontal === vertical) return;

        // Keep the centre marking legible on longer streets without turning
        // the narrow grid roads into solid painted strips.
        if ((x + z) % 2 !== 0) return;

        const p = point(x, z);

        result.push({
          position: [p[0], 0.067, p[2]],
          scale: horizontal
            ? [cell * 0.38, 0.012, cell * 0.035]
            : [cell * 0.035, 0.012, cell * 0.38],
        });
      });
    });

    return result;
  }, []);
  const pedestrianCrossings = useMemo<WorldInstance[]>(() => {
    const result: WorldInstance[] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        const left = rows[z]?.[x - 1] === "r";
        const right = rows[z]?.[x + 1] === "r";
        const up = rows[z - 1]?.[x] === "r";
        const down = rows[z + 1]?.[x] === "r";

        // Only target intersections where roads connect in both axes.
        const isIntersection = (left || right) && (up || down);

        if (!isIntersection) return;

        // Mark every connected junction so pedestrian crossings form a consistent
        // city-wide network instead of appearing only at a sparse subset.
        const horizontalRoad = left || right;
        const p = point(x, z);

        // Six narrow white stripes across the road.
        for (let stripe = 0; stripe < 6; stripe++) {
          const offset = (stripe - 2.5) * cell * 0.13;

          result.push({
            position: horizontalRoad ? [p[0] + offset, 0.075, p[2]] : [p[0], 0.075, p[2] + offset],
            scale: horizontalRoad
              ? [cell * 0.075, 0.012, cell * 0.42]
              : [cell * 0.42, 0.012, cell * 0.075],
          });
        }
      });
    });

    return result;
  }, []);
  const cars = useMemo<[number, number][]>(() => {
    return town.grid.carCells.flatMap(([x, z]) => {
      if (x === undefined || z === undefined) return [];

      const position = point(x, z);

      return [[position[0], position[2]] as [number, number]];
    });
  }, []);
  const trafficLights = useMemo<[number, number][]>(() => {
    const result: [number, number][] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        const left = rows[z]?.[x - 1] === "r";
        const right = rows[z]?.[x + 1] === "r";
        const up = rows[z - 1]?.[x] === "r";
        const down = rows[z + 1]?.[x] === "r";

        const horizontal = left || right;
        const vertical = up || down;

        // Only place traffic lights at connected intersections.
        if (!horizontal || !vertical) return;

        // Keep traffic lights relatively sparse.
        if ((x + z) % 5 !== 0) return;

        // Avoid placing them directly beneath parked cars.
        const occupiedByCar = town.grid.carCells.some(([carX, carZ]) => carX === x && carZ === z);

        if (occupiedByCar) return;

        const p = point(x, z);

        // Position the signal near the corner of the intersection.
        result.push([p[0] + cell * 0.38, p[2] + cell * 0.38]);
      });
    });

    return result;
  }, []);
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
    const candidates: { position: [number, number]; gridX: number; gridZ: number }[] = [];
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
          candidates.push({
            position: [p[0], p[2]],
            gridX: available.x,
            gridZ: available.z,
          });
        }
      });
    });

    const selectedLandmarks = new Set<string>();
    const selectedPositions: [number, number][] = [];

    return candidates
      .filter((_, index) => index % 6 === 0)
      .flatMap((candidate) => {
        const destination = props.places
          .map((place) => ({
            place,
            dx: place.grid.x - candidate.gridX,
            dz: place.grid.z - candidate.gridZ,
          }))
          .filter(({ dx, dz }) => Math.abs(dx) > Math.abs(dz))
          .sort((a, b) => Math.hypot(a.dx, a.dz) - Math.hypot(b.dx, b.dz))[0];

        if (!destination || selectedLandmarks.has(destination.place.id)) return [];

        const tooClose = selectedPositions.some(
          ([x, z]) => Math.hypot(candidate.position[0] - x, candidate.position[1] - z) < cell * 3,
        );
        if (tooClose) return [];

        selectedLandmarks.add(destination.place.id);
        selectedPositions.push(candidate.position);

        return [{
          position: candidate.position,
          destination: destination.place.label,
          direction: destination.dx > 0 ? "right" as const : "left" as const,
        }];
      })
      .slice(0, 3);
  }, [busStops, props.places]);
  const roadsideShops = useMemo<[number, number][]>(() => {
    const candidates: [number, number][] = [];
    const rows = town.grid.rows;

    rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        // Place shops north of the road so their entrances face the road.
        const shopX = x;
        const shopZ = z - 1;

        if (rows[shopZ]?.[shopX] !== "g") return;

        const roadCount = [
          rows[shopZ - 1]?.[shopX],
          rows[shopZ + 1]?.[shopX],
          rows[shopZ]?.[shopX - 1],
          rows[shopZ]?.[shopX + 1],
        ].filter((value) => value === "r").length;

        if (roadCount !== 1) return;

        const occupiedByCar = town.grid.carCells.some(
          ([carX, carZ]) => carX === shopX && carZ === shopZ,
        );

        if (occupiedByCar) return;

        const p = point(shopX, shopZ);

        const nearBusStop = busStops.some(
          ([busX, busZ]) => Math.hypot(p[0] - busX, p[2] - busZ) < cell * 2,
        );

        const nearRoadSign = roadSigns.some(
          (sign) => Math.hypot(p[0] - sign.position[0], p[2] - sign.position[1]) < cell * 2,
        );

        if (nearBusStop || nearRoadSign) return;

        candidates.push([p[0], p[2]]);
      });
    });

    // Keep shops separated so their structures do not overlap.
    const selected: [number, number][] = [];

    for (const candidate of candidates) {
      const tooClose = selected.some(
        ([x, z]) => Math.hypot(candidate[0] - x, candidate[1] - z) < cell * 2,
      );

      if (!tooClose) selected.push(candidate);

      if (selected.length === 2) break;
    }

    return selected;
  }, [busStops, roadSigns]);
  const motorcycles = useMemo<[number, number][]>(() => {
    return roadsideShops.map(([x, z]) => [x + cell * 0.72, z + cell * 0.1]);
  }, [roadsideShops]);
  const tricycles = useMemo<[number, number][]>(() => {
    return roadsideShops.map(([x, z]) => [x - cell * 0.9, z + cell * 0.15]);
  }, [roadsideShops]);
  const streetVendors = useMemo<[number, number][]>(() => {
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

        for (const { x: nx, z: nz } of neighbors) {
          if (rows[nz]?.[nx] !== "g") continue;

          const p = point(nx, nz);

          const tooClose = (locations: readonly [number, number][], distance: number) =>
            locations.some(
              ([otherX, otherZ]) => Math.hypot(p[0] - otherX, p[2] - otherZ) < cell * distance,
            );

          if (tooClose(busStops, 2)) continue;
          if (tooClose(roadsideShops, 1.8)) continue;
          if (tooClose(motorcycles, 1.5)) continue;
          if (tooClose(tricycles, 1.5)) continue;
          if (
            roadSigns.some(
              (sign) => Math.hypot(p[0] - sign.position[0], p[2] - sign.position[1]) < cell * 1.5,
            )
          )
            continue;

          candidates.push([p[0], p[2]]);
          break;
        }
      });
    });

    const selected: [number, number][] = [];

    for (const candidate of candidates) {
      const tooClose = selected.some(
        ([x, z]) => Math.hypot(candidate[0] - x, candidate[1] - z) < cell * 2,
      );

      if (!tooClose) selected.push(candidate);

      if (selected.length === 2) break;
    }

    return selected;
  }, [busStops, roadsideShops, motorcycles, tricycles, roadSigns]);
  const { sidewalks, curbs } = useMemo(() => {
    const occupied = new Set<string>();

    town.grid.buildings.forEach((building) => {
      occupied.add(`${building.x},${building.z}`);
      occupied.add(`${building.x + 1},${building.z}`);
      occupied.add(`${building.x},${building.z + 1}`);
      occupied.add(`${building.x + 1},${building.z + 1}`);
    });

    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    const sidewalkItems: WorldInstance[] = [];
    const curbItems: WorldInstance[] = [];

    const sidewalkWidth = cell * 0.28;
    const curbWidth = cell * 0.09;

    const directions = [
      { dx: 0, dz: -1 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
      { dx: 1, dz: 0 },
    ] as const;

    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        // Important: align with the existing road geometry.
        const center = point(x, z);

        const greenNeighbors = new Set<string>();

        directions.forEach(({ dx, dz }) => {
          const neighborX = x + dx;
          const neighborZ = z + dz;
          const neighborRow = town.grid.rows[neighborZ];

          if (!neighborRow || neighborRow[neighborX] !== "g") return;
          if (occupied.has(`${neighborX},${neighborZ}`)) return;

          greenNeighbors.add(`${dx},${dz}`);

          const horizontal = dx === 0;

          const sidewalkX = center[0] + dx * (cell / 2 + sidewalkWidth / 2);
          const sidewalkZ = center[2] + dz * (cell / 2 + sidewalkWidth / 2);

          sidewalkItems.push({
            position: [sidewalkX, 0.035, sidewalkZ],
            scale: horizontal ? [cell, 0.05, sidewalkWidth] : [sidewalkWidth, 0.05, cell],
          });

          curbItems.push({
            position: [center[0] + dx * (cell / 2), 0.105, center[2] + dz * (cell / 2)],
            scale: horizontal ? [cell, 0.09, curbWidth] : [curbWidth, 0.09, cell],
          });
        });

        // Fill outer sidewalk corners where both adjoining
        // pedestrian edges and the diagonal ground tile exist.
        for (const dx of [-1, 1] as const) {
          for (const dz of [-1, 1] as const) {
            const hasHorizontalEdge = greenNeighbors.has(`0,${dz}`);
            const hasVerticalEdge = greenNeighbors.has(`${dx},0`);

            if (!hasHorizontalEdge || !hasVerticalEdge) continue;

            const diagonalX = x + dx;
            const diagonalZ = z + dz;
            const diagonalRow = town.grid.rows[diagonalZ];

            if (!diagonalRow || diagonalRow[diagonalX] !== "g") continue;
            if (occupied.has(`${diagonalX},${diagonalZ}`)) continue;

            sidewalkItems.push({
              position: [
                center[0] + dx * (cell / 2 + sidewalkWidth / 2),
                0.035,
                center[2] + dz * (cell / 2 + sidewalkWidth / 2),
              ],
              scale: [sidewalkWidth, 0.05, sidewalkWidth],
            });
          }
        }
      });
    });

    return {
      sidewalks: sidewalkItems,
      curbs: curbItems,
    };
  }, []);

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
    town.grid.waterCells.forEach(([x, z]) => {
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
          canopyColor: worldFoliageColor(x * 37 + z * 61),
        });
      });
    });

    return result;
  }, []);
  const streetLights = useMemo<[number, number][]>(() => {
    const occupied = new Set<string>();

    // Exclude building footprints.
    town.grid.buildings.forEach((building) => {
      occupied.add(`${building.x},${building.z}`);
      occupied.add(`${building.x + 1},${building.z}`);
      occupied.add(`${building.x},${building.z + 1}`);
      occupied.add(`${building.x + 1},${building.z + 1}`);
    });

    // Exclude water and reserved plots.
    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    const roadCells: [number, number][] = [];

    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile === "r") roadCells.push([x, z]);
      });
    });

    const result: [number, number][] = [];
    const used = new Set<string>();

    roadCells.forEach(([roadX, roadZ], index) => {
      // Space streetlights along the roads.
      if (index % 6 !== 0) return;

      // Try different roadside positions to avoid obstructions.
      const sides: [number, number][] =
        index % 2 === 0
          ? [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ]
          : [
              [0, 1],
              [0, -1],
              [1, 0],
              [-1, 0],
            ];

      for (const [offsetX, offsetZ] of sides) {
        const x = roadX + offsetX;
        const z = roadZ + offsetZ;

        const row = town.grid.rows[z];
        if (!row || row[x] !== "g") continue;

        const key = `${x},${z}`;
        if (occupied.has(key) || used.has(key)) continue;

        // Avoid placing a streetlight where the tree generator places a tree.
        const seed = (x * 17 + z * 31) % 100;
        if (seed <= 38) continue;

        const p = point(x + 0.5, z + 0.5);

        result.push([p[0], p[2]]);
        used.add(key);
        break;
      }
    });

    return result;
  }, []);
  const wasteBins = useMemo<[number, number][]>(() => {
    const occupied = new Set<string>();

    // Reserve building footprints.
    town.grid.buildings.forEach((building) => {
      occupied.add(`${building.x},${building.z}`);
      occupied.add(`${building.x + 1},${building.z}`);
      occupied.add(`${building.x},${building.z + 1}`);
      occupied.add(`${building.x + 1},${building.z + 1}`);
    });

    // Reserve water, plots and streetlights.
    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    streetLights.forEach(([x, z]) => {
      const gridX = Math.round(x / cell + (gridCols - 1) / 2 - 0.5);
      const gridZ = Math.round(z / cell + (gridRows - 1) / 2 - 0.5);
      occupied.add(`${gridX},${gridZ}`);
    });

    const result: [number, number][] = [];
    const used = new Set<string>();

    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        // Keep bins relatively sparse.
        const seed = (x * 23 + z * 37) % 100;
        if (seed > 12) return;

        const sides: [number, number][] = [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ];

        for (const [offsetX, offsetZ] of sides) {
          const binX = x + offsetX;
          const binZ = z + offsetZ;

          const neighborRow = town.grid.rows[binZ];
          if (!neighborRow || neighborRow[binX] !== "g") continue;

          const key = `${binX},${binZ}`;

          if (occupied.has(key) || used.has(key)) continue;

          // Avoid tree locations.
          const treeSeed = (binX * 17 + binZ * 31) % 100;
          if (treeSeed <= 38) continue;

          const p = point(binX + 0.5, binZ + 0.5);

          result.push([p[0], p[2]]);
          used.add(key);
          break;
        }
      });
    });

    return result;
  }, [streetLights]);
  const roadsideInfrastructure = useMemo(() => {
    const occupied = new Set<string>();
    town.grid.buildings.forEach((building) => {
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        occupied.add(`${building.x + dx},${building.z + dz}`);
      }
    });
    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    // Reserve existing roadside props and deterministic tree cells before placing poles.
    const reservePositions = (positions: readonly [number, number][]) => {
      positions.forEach(([worldX, worldZ]) => {
        const gridX = Math.round(worldX / cell + (gridCols - 1) / 2 - 0.5);
        const gridZ = Math.round(worldZ / cell + (gridRows - 1) / 2 - 0.5);
        occupied.add(`${gridX},${gridZ}`);
      });
    };
    reservePositions(streetLights);
    reservePositions(wasteBins);
    reservePositions(trees.map((tree) => tree.position));
    reservePositions(busStops);
    reservePositions(roadsideShops);
    reservePositions(motorcycles);
    reservePositions(tricycles);
    reservePositions(streetVendors);

    const poles: [number, number][] = [];
    const spans: { start: [number, number]; end: [number, number] }[] = [];

    // Process each contiguous horizontal road run independently. This prevents
    // wires from jumping between parallel roads, gaps, or separate road segments.
    town.grid.rows.forEach((row, z) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "r" || row[x - 1] === "r") {
          x += 1;
          continue;
        }
        const runStart = x;
        while (x < row.length && row[x] === "r") x += 1;
        const runEnd = x - 1;
        if (runEnd - runStart < 4) continue;

        const sideZ = town.grid.rows[z - 1]?.[runStart] === "g" ? z - 1
          : town.grid.rows[z + 1]?.[runStart] === "g" ? z + 1
          : null;
        if (sideZ === null) continue;

        let previousPole: [number, number] | null = null;
        for (let roadX = runStart + 1; roadX <= runEnd - 1; roadX += 5) {
          if (town.grid.rows[sideZ]?.[roadX] !== "g") continue;
          const seed = (roadX * 17 + sideZ * 31) % 100;
          const key = `${roadX},${sideZ}`;
          if (seed <= 38 || occupied.has(key)) continue;

          const p = point(roadX + 0.5, sideZ + 0.5);
          const current: [number, number] = [p[0], p[2]];
          if (previousPole) {
            spans.push({ start: previousPole, end: current });
          }
          poles.push(current);
          previousPole = current;
          occupied.add(key);
        }
      }
    });

    const drains: { position: [number, number, number]; horizontal: boolean; length: number }[] = [];
    const directions = [
      { dx: 0, dz: -1 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
      { dx: 1, dz: 0 },
    ] as const;
    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;
        const center = point(x, z);
        directions.forEach(({ dx, dz }) => {
          const nx = x + dx;
          const nz = z + dz;
          if (town.grid.rows[nz]?.[nx] !== "g" || occupied.has(`${nx},${nz}`)) return;

          // The channel starts beyond the 0.28-cell sidewalk and curb, with
          // a small separation so their meshes do not overlap.
          const drainOffset = cell / 2 + cell * 0.28 + cell * 0.09 + cell * 0.035;
          drains.push({
            position: [
              center[0] + dx * drainOffset,
              0.025,
              center[2] + dz * drainOffset,
            ],
            horizontal: dx === 0,
            length: cell,
          });
        });
      });
    });
    return { poles, spans, drains };
  }, [streetLights, wasteBins, trees, busStops, roadsideShops, motorcycles, tricycles, streetVendors]);

  const badgePositions = useMemo(
    () => calculateBadgePositions(props.places, point, cell),
    [props.places],
  );
  const select = (event: ThreeEvent<MouseEvent> | null, action: () => void): boolean => {
    event?.stopPropagation();
    if (!isMapTargetSelectionAllowed(event?.delta, gesture.current.moved)) return false;
    action();
    return true;
  };
  return (
    <SurfaceBoundary onUnavailable={props.onUnavailable}>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        onPointerDownCapture={(event) => {
          gesture.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMoveCapture={(event) => {
          if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > MAP_DRAG_THRESHOLD_PX)
            gesture.current.moved = true;
        }}
        onPointerCancelCapture={() => {
          gesture.current.moved = true;
        }}
      >
        <Canvas
          shadows
          frameloop="always"
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          fallback={<span>WebGL is unavailable. Use the accessible map controls.</span>}
        >
          <Ready onReady={props.onReady} />
          <WorldCamera
            width={gridCols * cell}
            depth={gridRows * cell}
            target={selectedTarget?.position ?? [0, 0, 0]}
            zoom={1.35}
            freeExplore
          />
          <MapLighting size={gridCols * cell} />
          <Terrain3D gridCols={gridCols} gridRows={gridRows} cellSize={cell} waterCells={town.grid.waterCells} />

          <WorldRoads items={roads} />
          <WorldRoadMarkings items={roadMarkings} />
          <WorldPedestrianCrossings items={pedestrianCrossings} />
          <WorldTrafficLights positions={trafficLights} size={cell} />
          <WorldCars positions={cars} size={cell} />
          <WorldSidewalks sidewalks={sidewalks} curbs={curbs} />
          <WorldBusStops positions={busStops} size={cell} />
          <WorldRoadSigns positions={roadSigns} size={cell} />
          <WorldRoadsideShops positions={roadsideShops} size={cell} />
          <WorldMotorcycles positions={motorcycles} size={cell} />
          <WorldTricycles positions={tricycles} size={cell} />
          <WorldStreetVendors positions={streetVendors} size={cell} />
          <FunctionalStreetLights3D positions={streetLights} size={cell} isNight={isNight} />
          <RoadsideInfrastructure3D poles={roadsideInfrastructure.poles} spans={roadsideInfrastructure.spans} drains={roadsideInfrastructure.drains} cellSize={cell} />
          <WorldWasteBins positions={wasteBins} size={cell} />
          <WorldInstances
            tone="slate"
            items={town.grid.waterCells.map(([x, z]) => ({
              position: [point(x!, z!)[0], 0.015, point(x!, z!)[2]],
              scale: [cell, 0.03, cell],
            }))}
          />
          <WorldInstances
            tone="wall"
            items={town.grid.plotCells.map(([x, z]) => ({
              position: [point(x!, z!)[0], 0.015, point(x!, z!)[2]],
              scale: [cell, 0.03, cell],
            }))}
          />
          <WorldTrees positions={trees} />
          {town.grid.buildings.map((building) => (
            <WorldHouse
              key={`building-${building.x}-${building.z}`}
              position={point(building.x + 0.5, building.z + 0.5)}
              width={cell * 1.15}
              depth={cell * 1.15}
              variant={getLandmarkBuildingVariant(building.buildingType)}
              detailed
            />
          ))}
          <MovingTraffic3D paths={trafficRoutes} />
          <MovingPedestrians3D paths={pedestrianRoutes} />
          <DistrictZones
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
            const badgePosition = badgePositions.get(place.id);
            const [x, , z] = point(place.grid.x, place.grid.z);

            if (!badgePosition) return null;

            return (
              <LandmarkItem3D
                key={place.id}
                place={place}
                position={badgePosition}
                isSelected={selectedTarget?.id === place.id}
                isHovered={hoveredTargetId === place.id}
                onSelectLandmark={(id) =>
                  select(null, () => {
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
              isNight={isNight}
              isSelected={selectedTarget?.id === property.id || props.selectedPropertyId === property.id}
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
                setHovered((property.label ?? "Home") + " · " + property.status.replace("_", " "));
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
          <WorldPeople
            positions={
              props.playerLocation
                ? [
                    [
                      point(props.playerLocation.x, props.playerLocation.y)[0],
                      point(props.playerLocation.x, props.playerLocation.y)[2],
                    ],
                  ]
                : []
            }
          />
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
          Drag to rotate · Two-finger drag to pan · Scroll or pinch to zoom
        </div>
        {hovered && (
          <div
            role="status"
            style={{
              position: "absolute",
              top: 12,
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
