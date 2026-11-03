import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import town from "@/data/osogbo-town.json";
import type { PhaserMapData, PhaserMapCallbacks } from "./PhaserMapSurface";
import {
  WorldCamera,
  WorldHouse,
  WorldLighting,
  WorldMaterial,
  WorldPeople,
  WorldRoads,
  WorldTrees,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { WORLD_SCALE, WORLD_PALETTE } from "../3d/world-theme";

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
  const trees = useMemo(
    () =>
      town.grid.rows.flatMap((row, z) =>
        Array.from(row).flatMap((tile, x): [number, number][] =>
          tile === "g" && x % 5 === 0 && z % 5 === 0 ? [[point(x, z)[0], point(x, z)[2]]] : [],
        ),
      ),
    [],
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
          <WorldCamera width={24 * cell} depth={18 * cell} />
          <WorldLighting size={24 * cell} />
          <mesh position={[0, -0.12, 0]} receiveShadow>
            <boxGeometry args={[24 * cell, 0.2, 18 * cell]} />
            <WorldMaterial tone="ground" />
          </mesh>
          <WorldRoads items={roads} />
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
            />
          ))}
          {town.districts.map((district) => {
            const a = district.gridArea;
            const p = point(a.x + a.width / 2 - 0.5, a.z + a.depth / 2 - 0.5);
            return (
              <mesh
                key={district.id}
                position={[p[0], 0.005, p[2]]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(event) => select(event, () => props.onSelectDistrict(district.id))}
              >
                <planeGeometry args={[a.width * cell, a.depth * cell]} />
                <WorldMaterial tone="ground" />
              </mesh>
            );
          })}
          {props.places.map((place) => (
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
              <WorldHouse
                position={point(place.grid.x, place.grid.z)}
                shop={place.category === "market" || place.category === "food"}
              />
            </group>
          ))}
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
