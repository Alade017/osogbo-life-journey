import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Html } from "@react-three/drei";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WorldStreetFurniture } from "@/components/3d/WorldStreetFurniture";
import { worldAppearance, worldEquipment } from "@/game/world-character-view";
import { Canvas } from "@react-three/fiber";
import type { NeighborhoodPlayerView, PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";
import type { playableDistrictForLocation } from "@/game/playable-district";
import { neighborhoodSceneBounds, toScene } from "@/game/neighborhood-model";
import { neighborhoodBuildingFootprint } from "@/game/neighborhood-geometry";
import {
  WorldCamera,
  WorldHouse,
  WorldLighting,
  WorldMaterial,
  WorldPeople,
  WorldRoads,
  WorldTrees,
  type WorldTree,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { WORLD_CAMERA, WORLD_SCALE } from "../3d/world-theme";

class NeighborhoodBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <p className="neighborhood-renderer-error" role="alert">
        The neighbourhood could not be drawn. Your saved world state is unchanged. Try a browser
        with WebGL support.
      </p>
    ) : (
      this.props.children
    );
  }
}

export function R3FNeighborhoodSurface({
  players,
  selfSessionId,
  district,
  onScene,
  zoom,
  onZoomChange,
}: {
  players: readonly NeighborhoodPlayerView[];
  selfSessionId: string;
  homeTypeId: string | null;
  district: NonNullable<ReturnType<typeof playableDistrictForLocation>>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onScene: (scene: PhaserNeighborhoodHandle | null) => void;
}) {
  const overlayHost = useRef<HTMLDivElement>(null!);
  const [follow, setFollow] = useState(true);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const area = district.area;
  const bounds = neighborhoodSceneBounds(district.origin);
  const unit = WORLD_SCALE.neighborhoodUnit;
  const centerX = bounds.left + bounds.width / 2;
  const centerZ = bounds.top + bounds.height / 2;
  const point = useCallback(
    (x: number, z: number): [number, number, number] => [
      (x - centerX) * unit,
      0,
      (z - centerZ) * unit,
    ],
    [centerX, centerZ, unit],
  );
  useEffect(() => {
    // Preserve the host's camera interface; network state stays React-owned.
    onScene({
      setPlayers: () => undefined,
      setZoom: (factor) =>
        onZoomChange(
          Math.max(WORLD_CAMERA.minZoom, Math.min(WORLD_CAMERA.maxZoom, zoomRef.current * factor)),
        ),
      setFollow,
    });
    return () => onScene(null);
  }, [onScene, onZoomChange]);
  const roads = useMemo(
    (): WorldInstance[] =>
      (area.roads ?? []).map((road) => {
        const vertical = road.axis === "vertical";
        const start = road.start ?? (vertical ? bounds.top : bounds.left);
        const end =
          road.end ?? (vertical ? bounds.top + bounds.height : bounds.left + bounds.width);
        const p = point(
          vertical ? road.offset : (start + end) / 2,
          vertical ? (start + end) / 2 : road.offset,
        );
        return {
          position: [p[0], 0.03, p[2]],
          scale: vertical
            ? [road.width * unit, 0.06, (end - start) * unit]
            : [(end - start) * unit, 0.06, road.width * unit],
        };
      }),
    [area, bounds.left, bounds.top, bounds.width, bounds.height, point, unit],
  );
  const self = players.find((player) => player.sessionId === selfSessionId);
  const selfPoint = self && toScene(self, district.origin);
  const target: [number, number, number] =
    follow && selfPoint ? point(selfPoint.x, selfPoint.y) : [0, 0, 0];
  const trees: WorldTree[] = (area.obstacles ?? [])
    .filter((o) => o.kind === "tree")
    .map((o, index) => {
      const p = point(o.x, o.y);

      // Deterministic variation based on tree index.
      const variation = (index * 17) % 30;

      return {
        position: [p[0], p[2]],
        height: 0.85 + variation / 100,
        canopyScale: 0.85 + ((index * 13) % 35) / 100,
      };
    });
  return (
    <NeighborhoodBoundary>
      <div className="playable-neighborhood-canvas">
        <Canvas
          shadows
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "low-power" }}
        >
          <WorldCamera
            width={17}
            depth={14}
            target={target}
            zoom={zoom}
            onZoomChange={onZoomChange}
          />
          <WorldLighting size={Math.max(bounds.width, bounds.height) * unit} />
          <mesh position={[0, -0.12, 0]} receiveShadow>
            <boxGeometry args={[bounds.width * unit, 0.2, bounds.height * unit]} />
            <WorldMaterial tone="ground" />
          </mesh>
          <WorldRoads items={roads} />
          <WorldInstances
            tone="wall"
            items={roads.flatMap((road) => {
              const [w, , d] = road.scale!;
              const vertical = d > w;
              return [-1, 1].map((side) => ({
                position: [
                  road.position[0] + (vertical ? side * (w / 2 + 0.3) : 0),
                  0.085,
                  road.position[2] + (vertical ? 0 : side * (d / 2 + 0.3)),
                ] as [number, number, number],
                scale: [vertical ? 0.6 : w, 0.1, vertical ? d : 0.6] as [number, number, number],
              }));
            })}
          />
          {area.paths?.map((path) => {
            const p = point((path.from.x + path.to.x) / 2, (path.from.y + path.to.y) / 2);
            return (
              <mesh
                key={path.id}
                position={[p[0], 0.02, p[2]]}
                rotation={[0, -Math.atan2(path.to.y - path.from.y, path.to.x - path.from.x), 0]}
                receiveShadow
              >
                <boxGeometry
                  args={[
                    Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y) * unit,
                    0.025,
                    path.width * unit,
                  ]}
                />
                <WorldMaterial tone="wall" />
              </mesh>
            );
          })}
          <WorldTrees positions={trees} />

          {area.obstacles
            ?.filter((o) => ["compound", "shop", "kiosk"].includes(o.kind))
            .map((o) => (
              <WorldHouse
                detailed
                key={o.id}
                position={point(o.x, o.y)}
                width={o.width * unit}
                depth={o.height * unit}
                shop={o.kind !== "compound"}
              />
            ))}
          <WorldStreetFurniture
            items={(area.obstacles ?? [])
              .filter((o) => !["tree", "compound", "shop", "kiosk"].includes(o.kind))
              .map((o) => ({
                kind: o.kind,
                x: point(o.x, o.y)[0],
                z: point(o.x, o.y)[2],
                width: o.width * unit,
                depth: o.height * unit,
              }))}
          />
          {area.objects
            .filter((o) => o.kind !== "npc")
            .map((o) => {
              const footprint = neighborhoodBuildingFootprint(o);
              return (
                <group key={o.id}>
                  <WorldHouse
                    detailed
                    position={point(
                      footprint.left + footprint.width / 2,
                      footprint.top + footprint.height / 2,
                    )}
                    width={footprint.width * unit}
                    depth={footprint.height * unit}
                    shop={o.kind !== "home"}
                  />
                  <Html
                    portal={overlayHost}
                    center
                    position={[point(o.x, o.y)[0], 3.7, point(o.x, o.y)[2]]}
                    distanceFactor={18}
                    style={{ pointerEvents: "none" }}
                  >
                    <span className="world-place-label">{o.name}</span>
                  </Html>
                </group>
              );
            })}
          {players.map((player) => {
            const p = toScene(player, district.origin);
            return (
              <WorldCharacter
                key={player.sessionId}
                name={player.name}
                appearance={worldAppearance(player.appearance)}
                gender={player.gender}
                equipment={worldEquipment(player.equipment)}
                position={point(p.x, p.y)}
                facing={player.facing}
                animation={player.actionAnimation ?? "idle"}
              />
            );
          })}
          <WorldPeople
            positions={area.objects
              .filter((o) => o.kind === "npc")
              .map((o) => [point(o.x, o.y)[0], point(o.x, o.y)[2]] as [number, number])}
          />
        </Canvas>
        <div ref={overlayHost} className="world-label-layer" />
      </div>
    </NeighborhoodBoundary>
  );
}
