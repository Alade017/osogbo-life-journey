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
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { NeighborhoodPlayerView, PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";
import type { playableDistrictForLocation } from "@/game/playable-district";
import {
  neighborhoodSceneBounds,
  toScene,
  type NeighborhoodNpcView,
  type NeighborhoodObject,
} from "@/game/neighborhood-model";
import { neighborhoodBuildingFootprint } from "@/game/neighborhood-geometry";
import {
  WorldCamera,
  WorldCars,
  WorldHouse,
  WorldLighting,
  WorldMaterial,
  WorldPedestrianCrossings,
  WorldPeople,
  WorldRoadMarkings,
  WorldRoads,
  WorldSidewalks,
  WorldStreetLights,
  WorldTrafficLights,
  WorldStreetVendors,
  WorldTrees,
  type WorldTree,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { CHARACTER_MOTION } from "@/components/3d/character-config";
import { WORLD_CAMERA, WORLD_PALETTE, WORLD_SCALE } from "../3d/world-theme";
import { districtArchitectureVariantForCategory } from "@/game/district-architecture";
import {
  carSpots,
  pedestrianCrossings,
  pedestrianCrossingStripes,
  pedestrianSpots,
  roadMarkings,
  sidewalksAndCurbs,
  streetLightSpots,
  trafficLightSpots,
  treeVisualProfile,
  vendorSpots,
  type DressingRect,
} from "@/game/neighborhood-dressing";

/** The nearest other character within range, so heads turn toward someone close by. */
function nearestCharacter(
  origin: readonly [number, number, number],
  others: readonly (readonly [number, number, number])[],
  range: number,
): readonly [number, number, number] | null {
  let best: readonly [number, number, number] | null = null;
  let bestDistance = range;
  for (const other of others) {
    const distance = Math.hypot(other[0] - origin[0], other[2] - origin[2]);
    if (distance > 0 && distance <= bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

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

function NeighborhoodNpcActor({
  npc,
  start,
  target,
  waypoints,
  onSelect,
  onArrive,
  onPause,
}: {
  npc: NeighborhoodNpcView;
  start: [number, number, number];
  target: [number, number, number];
  waypoints: readonly [number, number, number][];
  onSelect: () => void;
  onArrive: () => void;
  onPause: (x: number, y: number) => void;
}) {
  const group = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const { invalidate } = useThree();
  const animated =
    !npc.isPaused &&
    (npc.isMoving || ["working", "shopping", "socializing"].includes(npc.activityKind));
  const targetKey = `${target[0].toFixed(3)}:${target[2].toFixed(3)}`;
  const arrivedTarget = useRef<string | null>(null);
  const waypointIndex = useRef(0);
  const pauseSnapshotSaved = useRef(false);
  useEffect(() => {
    waypointIndex.current = 0;
    arrivedTarget.current = null;
  }, [target[0], target[2], waypoints]);

  // R3F receives a newly allocated start tuple on every parent render.
  // Only apply it when the actual spawn/confirmed position changes; otherwise
  // React reconciliation would reset the actor during its frame-based walk.
  useEffect(() => {
    const actor = group.current;
    if (!actor) return;
    actor.position.set(start[0], start[1], start[2]);
    invalidate();
  }, [start[0], start[1], start[2], invalidate]);

  // Pausing the simulation freezes the rendered actor where it actually is.
  // Persist that point so interactions and resume logic use the same position.
  useEffect(() => {
    if (!npc.isPaused) {
      pauseSnapshotSaved.current = false;
      return;
    }
    if (pauseSnapshotSaved.current) return;
    const actor = group.current;
    if (!actor) return;
    pauseSnapshotSaved.current = true;
    onPause(actor.position.x, actor.position.z);
  }, [npc.isPaused, onPause]);

  useEffect(() => {
    if (!animated) return;
    const timer = window.setInterval(invalidate, 1000 / 15);
    return () => window.clearInterval(timer);
  }, [animated, invalidate]);

  useFrame((state, delta) => {
    const actor = group.current;
    if (!actor || npc.isPaused) return;
    const waypoint = waypoints[waypointIndex.current] ?? target;
    const dx = waypoint[0] - actor.position.x;
    const dz = waypoint[2] - actor.position.z;
    const distance = Math.hypot(dx, dz);
    const walking = distance > 0.035;
    if (walking) {
      // A later trip may revisit the same destination. Treat it as a new arrival
      // after movement resumes so the confirmed position is persisted again.
      arrivedTarget.current = null;
      const step = 1 - Math.exp(-Math.min(delta, 0.1) * 2.8);
      actor.position.x += dx * step;
      actor.position.z += dz * step;
      actor.rotation.y = Math.atan2(dx, dz);
    } else if (waypointIndex.current < waypoints.length - 1) {
      waypointIndex.current += 1;
    } else {
      actor.position.x = target[0];
      actor.position.z = target[2];
      if (arrivedTarget.current !== targetKey) {
        arrivedTarget.current = targetKey;
        onArrive();
      }
    }
    const phase = state.clock.elapsedTime * (walking ? 7 : 2.2);
    const swing = walking ? Math.sin(phase) * 0.42 : 0;
    const workMotion = npc.activityKind === "working" ? Math.sin(phase) * 0.16 : 0;
    const socialMotion = npc.activityKind === "socializing" ? Math.sin(phase) * 0.1 : 0;
    if (leftArm.current) leftArm.current.rotation.x = swing + workMotion + socialMotion;
    if (rightArm.current) rightArm.current.rotation.x = -swing + workMotion;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing * 0.8;
    if (rightLeg.current) rightLeg.current.rotation.x = swing * 0.8;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.52, 4, 8]} />
        <WorldMaterial tone="slate" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <WorldMaterial tone="clay" />
      </mesh>
      <group ref={leftArm} position={[-0.29, 1.08, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.12, 0.42, 0.13]} />
          <WorldMaterial tone="clay" />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.29, 1.08, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.12, 0.42, 0.13]} />
          <WorldMaterial tone="clay" />
        </mesh>
      </group>
      <group ref={leftLeg} position={[-0.12, 0.48, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <WorldMaterial tone="timber" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.12, 0.48, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <WorldMaterial tone="timber" />
        </mesh>
      </group>
      <mesh
        position={[0, 0.92, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <cylinderGeometry args={[0.42, 0.42, 1.9, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center position={[0, 2.05, 0]} distanceFactor={18} style={{ pointerEvents: "none" }}>
        <span className="world-place-label">{npc.name}</span>
      </Html>
    </group>
  );
}

export function R3FNeighborhoodSurface({
  players,
  selfSessionId,
  district,
  mapCategory,
  npcs,
  interactionTargets,
  onSelectTarget,
  onNpcArrive,
  onScene,
  zoom,
  onZoomChange,
  onGroundTap,
  groundTarget,
}: {
  onGroundTap: (point: { x: number; y: number }) => void;
  groundTarget: { x: number; y: number } | null;
  players: readonly NeighborhoodPlayerView[];
  npcs: readonly NeighborhoodNpcView[];
  interactionTargets: readonly NeighborhoodObject[];
  onSelectTarget: (targetId: string) => void;
  onNpcArrive: (npcId: string, x: number, y: number) => void;
  selfSessionId: string;
  homeTypeId: string | null;
  district: NonNullable<ReturnType<typeof playableDistrictForLocation>>;
  mapCategory: string | null | undefined;
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
  // Street dressing comes from the area's own roads, objects and stalls.
  const dressing = useMemo(() => {
    const kerbs = sidewalksAndCurbs(area, bounds);
    const crossings = pedestrianCrossings(area);
    return {
      markings: roadMarkings(area, bounds),
      sidewalks: kerbs.sidewalks,
      curbs: kerbs.curbs,
      crossings,
      crossingStripes: pedestrianCrossingStripes(crossings),
      lights: streetLightSpots(area, bounds),
      trafficLights: trafficLightSpots(area),
      cars: carSpots(area, bounds),
      people: pedestrianSpots(area, bounds),
      vendors: vendorSpots(area),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, bounds.left, bounds.top, bounds.width, bounds.height]);
  const street = useMemo(() => {
    const flat = (rects: readonly DressingRect[], y: number, height: number): WorldInstance[] =>
      rects.map((rect) => {
        const p = point(rect.x, rect.y);
        return {
          position: [p[0], y, p[2]],
          scale: [rect.width * unit, height, rect.depth * unit],
        };
      });
    const onGround = (spots: readonly { x: number; y: number }[]): [number, number][] =>
      spots.map((spot) => {
        const p = point(spot.x, spot.y);
        return [p[0], p[2]];
      });
    const vehiclePositions = dressing.cars.map((spot) => {
      const p = point(spot.x, spot.y);
      return [p[0], p[2], spot.rotation] as [number, number, number];
    });
    const trafficLightPositions = dressing.trafficLights.map((spot) => {
      const p = point(spot.x, spot.y);
      return [p[0], p[2], spot.rotation] as [number, number, number];
    });
    return {
      markings: flat(dressing.markings, 0.07, 0.03),
      crossings: flat(dressing.crossingStripes, 0.07, 0.03),
      sidewalks: flat(dressing.sidewalks, 0.05, 0.1),
      curbs: flat(dressing.curbs, 0.09, 0.14),
      lights: onGround(dressing.lights),
      trafficLights: trafficLightPositions,
      cars: vehiclePositions,
      people: onGround(dressing.people),
      vendors: onGround(dressing.vendors),
    };
  }, [dressing, point, unit]);
  const streetSize = WORLD_SCALE.neighborhoodStreetCell;
  const lookRange = CHARACTER_MOTION.lookRange * WORLD_SCALE.character;
  const scenePoints = players.map((player) => {
    const p = toScene(player, district.origin);
    return point(p.x, p.y);
  });
  const npcPoints = npcs.map((npc) => point(npc.x, npc.y));
  const self = players.find((player) => player.sessionId === selfSessionId);
  const selfPoint = self && toScene(self, district.origin);
  const target: [number, number, number] =
    follow && selfPoint ? point(selfPoint.x, selfPoint.y) : [0, 0, 0];
  const trees: WorldTree[] = (area.obstacles ?? [])
    .filter((o) => o.kind === "tree")
    .map((obstacle) => {
      const p = point(obstacle.x, obstacle.y);
      const profile = treeVisualProfile(obstacle);

      return {
        position: [p[0], p[2]],
        ...profile,
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
            width={bounds.width * unit}
            depth={bounds.height * unit}
            target={target}
            zoom={zoom}
            onZoomChange={onZoomChange}
          />
          <WorldLighting size={Math.max(bounds.width, bounds.height) * unit} />
          <mesh position={[0, -0.12, 0]} receiveShadow>
            <boxGeometry args={[bounds.width * unit, 0.2, bounds.height * unit]} />
            <WorldMaterial
              tone="ground"
              color={`#${area.style.ground.toString(16).padStart(6, "0")}`}
            />
          </mesh>
          <WorldRoads items={roads} />
          <WorldRoadMarkings items={street.markings} />
          <WorldPedestrianCrossings items={street.crossings} />
          <WorldSidewalks sidewalks={street.sidewalks} curbs={street.curbs} />
          <WorldStreetLights positions={street.lights} size={streetSize} />
          <WorldTrafficLights positions={street.trafficLights} size={streetSize} />
          <WorldCars positions={street.cars} size={streetSize} />
          <WorldStreetVendors positions={street.vendors} size={streetSize} />
          <WorldPeople positions={street.people} />
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
                height={WORLD_SCALE.neighborhoodBuildingHeight}
                shop={o.kind !== "compound"}
                variant={o.kind === "compound" ? "residential" : "market"}
              />
            ))}
          <WorldStreetFurniture
            items={(area.obstacles ?? [])
              .filter((o) =>
                ["streetlight", "bench", "bin", "sign", "landmark"].includes(o.kind),
              )
              .map((o) => ({
                kind: o.kind,
                x: point(o.x, o.y)[0],
                z: point(o.x, o.y)[2],
                width: o.width * unit,
                depth: o.height * unit,
              }))}
          />
          {area.obstacles
            ?.filter(
              (obstacle) =>
                ["sign", "landmark"].includes(obstacle.kind) && obstacle.label,
            )
            .map((landmark) => {
              const p = point(landmark.x, landmark.y);
              return (
                <Html
                  key={landmark.id}
                  portal={overlayHost}
                  center
                  position={[p[0], 2.4, p[2]]}
                  distanceFactor={18}
                  style={{ pointerEvents: "none" }}
                >
                  <span className="world-place-label">{landmark.label}</span>
                </Html>
              );
            })}
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
                    height={WORLD_SCALE.neighborhoodBuildingHeight}
                    shop={o.kind !== "home"}
                    variant={
                      o.kind === "home"
                        ? "residential"
                        : o.kind === "market"
                          ? "market"
                          : districtArchitectureVariantForCategory(mapCategory)
                    }
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
          {players.map((player, index) => {
            const p = toScene(player, district.origin);
            const position = point(p.x, p.y);
            const others = [...scenePoints.filter((_, other) => other !== index), ...npcPoints];
            return (
              <WorldCharacter
                key={player.sessionId}
                name={player.name}
                appearance={worldAppearance(player.appearance)}
                gender={player.gender}
                equipment={worldEquipment(player.equipment)}
                position={position}
                facing={player.facing}
                animation={player.actionAnimation ?? "idle"}
                lookAt={nearestCharacter(position, others, lookRange)}
              />
            );
          })}
          {npcs.map((npc) => (
            <NeighborhoodNpcActor
              key={npc.id}
              npc={npc}
              start={point(npc.x, npc.y)}
              target={point(npc.targetX, npc.targetY)}
              waypoints={(npc.path ?? []).map((waypoint) => point(waypoint.x, waypoint.y))}
              onSelect={() => onSelectTarget(npc.id)}
              onArrive={() => onNpcArrive(npc.id, npc.targetX, npc.targetY)}
              onPause={(x, z) =>
                onNpcArrive(npc.id, centerX + x / unit, centerZ + z / unit)
              }
            />
          ))}
          {/* Ground that takes taps and clicks: the character walks to the tapped point. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
            onClick={(event) => {
              event.stopPropagation();
              onGroundTap({
                x: centerX + event.point.x / unit,
                y: centerZ + event.point.z / unit,
              });
            }}
          >
            <planeGeometry args={[bounds.width * unit, bounds.height * unit]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {groundTarget && (
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[
                point(groundTarget.x, groundTarget.y)[0],
                0.12,
                point(groundTarget.x, groundTarget.y)[2],
              ]}
              raycast={() => null}
            >
              <ringGeometry
                args={[WORLD_SCALE.character * 0.1, WORLD_SCALE.character * 0.14, 24]}
              />
              <meshBasicMaterial
                color={WORLD_PALETTE.sign}
                transparent
                opacity={0.9}
                depthWrite={false}
              />
            </mesh>
          )}
          {interactionTargets
            .filter((target) => target.kind !== "npc")
            .map((target) => {
              // Match the invisible interaction volume to the same footprint
              // used by WorldHouse, including its forward depth offset.
              const footprint = neighborhoodBuildingFootprint(target);
              const p = point(
                footprint.left + footprint.width / 2,
                footprint.top + footprint.height / 2,
              );
              return (
                <mesh
                  key={target.id}
                  position={[p[0], WORLD_SCALE.neighborhoodBuildingHeight / 2, p[2]]}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTarget(target.id);
                  }}
                >
                  <boxGeometry
                    args={[
                      footprint.width * unit,
                      WORLD_SCALE.neighborhoodBuildingHeight,
                      footprint.height * unit,
                    ]}
                  />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              );
            })}
        </Canvas>
        <div ref={overlayHost} className="world-label-layer" />
      </div>
    </NeighborhoodBoundary>
  );
}
