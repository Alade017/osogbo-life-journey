import { DistrictZones } from "./DistrictZones";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import town from "@/data/osogbo-town.json";
import type { PhaserMapData, PhaserMapCallbacks } from "./PhaserMapSurface";
import {
  WorldCamera,
  WorldHouse,
  WorldMaterial,
  WorldPeople,
  WorldRoads,
  WorldStreetLights,
  WorldWasteBins,
  WorldSidewalks,
  WorldTrees,
  type WorldTree,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { WORLD_SCALE, WORLD_PALETTE } from "../3d/world-theme";
import { MapLighting } from "./MapLighting";
import { PlaceBadge } from "./map-badge";

type Props = PhaserMapData &
  PhaserMapCallbacks & { onReady: () => void; onUnavailable: () => void };
const cell = WORLD_SCALE.townCell;
const point = (x: number, z: number): [number, number, number] => [
  (x - 11.5) * cell,
  0,
  (z - 8.5) * cell,
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
  const { sidewalks, curbs } = useMemo(() => {
    const occupied = new Set<string>();

    // Reserve building footprints.
    town.grid.buildings.forEach((building) => {
      occupied.add(`${building.x},${building.z}`);
      occupied.add(`${building.x + 1},${building.z}`);
      occupied.add(`${building.x},${building.z + 1}`);
      occupied.add(`${building.x + 1},${building.z + 1}`);
    });

    // Reserve water and plots.
    [...town.grid.waterCells, ...town.grid.plotCells].forEach(([x, z]) => {
      occupied.add(`${x},${z}`);
    });

    const sidewalkItems: WorldInstance[] = [];
    const curbItems: WorldInstance[] = [];

    const sidewalkWidth = cell * 0.28;
    const curbWidth = cell * 0.09;

    const directions = [
      { dx: 0, dz: -1, side: "north" },
      { dx: 0, dz: 1, side: "south" },
      { dx: -1, dz: 0, side: "west" },
      { dx: 1, dz: 0, side: "east" },
    ] as const;

    town.grid.rows.forEach((row, z) => {
      Array.from(row).forEach((tile, x) => {
        if (tile !== "r") return;

        const center = point(x + 0.5, z + 0.5);

        directions.forEach(({ dx, dz, side }) => {
          const neighborX = x + dx;
          const neighborZ = z + dz;

          const neighborRow = town.grid.rows[neighborZ];

          // Only build sidewalks beside green ground tiles.
          if (!neighborRow || neighborRow[neighborX] !== "g") return;

          if (occupied.has(`${neighborX},${neighborZ}`)) return;

          const horizontal = side === "north" || side === "south";

          const sidewalkX = center[0] + dx * (cell / 2 + sidewalkWidth / 2);

          const sidewalkZ = center[2] + dz * (cell / 2 + sidewalkWidth / 2);

          sidewalkItems.push({
            position: [sidewalkX, 0.035, sidewalkZ],
            scale: horizontal ? [cell, 0.05, sidewalkWidth] : [sidewalkWidth, 0.05, cell],
          });

          // Raised curb sits directly on the road boundary.
          curbItems.push({
            position: [center[0] + dx * (cell / 2), 0.105, center[2] + dz * (cell / 2)],
            scale: horizontal ? [cell, 0.09, curbWidth] : [curbWidth, 0.09, cell],
          });
        });
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
      const gridX = Math.round(x / cell + 11.5 - 0.5);
      const gridZ = Math.round(z / cell + 8.5 - 0.5);
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
  const badgePositions = useMemo(
    () => calculateBadgePositions(props.places, point, cell),
    [props.places],
  );
  const select = (event: ThreeEvent<MouseEvent>, action: () => void) => {
    event.stopPropagation();
    if (event.delta <= 5 && !gesture.current.moved) action();
  };
  return (
    <SurfaceBoundary onUnavailable={props.onUnavailable}>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        onPointerDownCapture={(event) => {
          gesture.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMoveCapture={(event) => {
          if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 6)
            gesture.current.moved = true;
        }}
        onPointerCancelCapture={() => {
          gesture.current.moved = true;
        }}
      >
        <Canvas
          shadows
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          fallback={<span>WebGL is unavailable. Use the accessible map controls.</span>}
        >
          <Ready onReady={props.onReady} />
          <WorldCamera width={16 * cell} depth={12 * cell} zoom={1.3} />
          <MapLighting size={24 * cell} />
          <mesh position={[0, -0.12, 0]} receiveShadow>
            <boxGeometry args={[24 * cell, 0.2, 18 * cell]} />
            <WorldMaterial tone="ground" />
          </mesh>
          <WorldRoads items={roads} />
          <WorldSidewalks sidewalks={sidewalks} curbs={curbs} />
          <WorldStreetLights positions={streetLights} size={cell} />
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
              width={cell * 0.65}
              depth={cell * 0.65}
              variant={building.buildingType}
              detailed
            />
          ))}
          <DistrictZones
            districts={town.districts}
            point={point}
            cell={cell}
            onSelect={(id, event) => select(event, () => props.onSelectDistrict(id))}
          />
          {props.places.map((place) => {
            const badgePosition = badgePositions.get(place.id);

            const [x, , z] = point(place.grid.x, place.grid.z);

            if (!badgePosition) return null;

            return (
              <group
                key={place.id}
                name={`landmark:${place.id}`}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHovered(place.label);
                }}
                onPointerOut={() => setHovered(null)}
                onClick={(event) => select(event, () => props.onSelectLandmark(place.id))}
              >
                {/* Building stays at its original grid coordinate */}

                {/* Only the floating badge receives the adjusted position */}
                <PlaceBadge
                  position={badgePosition}
                  label={place.label}
                  category={place.category}
                />
              </group>
            );
          })}
          {props.properties?.map((property) => (
            <WorldHouse
              key={property.id}
              position={point(property.position[0] / 2 + 6.5, property.position[2] / 2 + 4.5)}
              rotation={property.rotation ?? 0}
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
