import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MutableRefObject,
} from "react";
import { Html, useGLTF } from "@react-three/drei";
import { fitFurniture } from "@/components/3d/VenueFurniture";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { BuildingOcclusion } from "@/components/3d/BuildingOcclusion";
import { WaypointBeacon } from "./WaypointBeacon";
import { WorldStreetFurniture } from "@/components/3d/WorldStreetFurniture";
import { worldAppearance, worldEquipment } from "@/game/world-character-view";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { NeighborhoodPlayerView, NeighborhoodSceneHandle } from "@/game/neighborhood-types";
import type { playableDistrictForLocation } from "@/game/playable-district";
import {
  neighborhoodSceneBounds,
  toScene,
  type NeighborhoodNpcView,
  type NeighborhoodObject,
} from "@/game/neighborhood-model";
import { neighborhoodBuildingFootprint } from "@/game/neighborhood-geometry";
import { neighborhoodObstacleFootprint } from "@/game/neighborhood-geometry";
import { NEIGHBORHOOD_TILE_SIZE } from "@/game/neighborhood-geometry";
import {
  NEIGHBORHOOD_NPC_ACTOR_SEPARATION,
  neighborhoodNpcAvoidanceBias,
  neighborhoodNpcAvoidanceStep,
  neighborhoodNpcPathWithFallback,
  neighborhoodNpcReplanDelay,
  neighborhoodNpcReservationPath,
  type NpcPoint,
} from "@/game/neighborhood-npc-layout";
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
  WorldStreetVendors,
  WorldTrees,
  type WorldTree,
  WorldInstances,
  type WorldInstance,
} from "../3d/WorldScene";
import { CHARACTER_MOTION } from "@/components/3d/character-config";
import { NEIGHBORHOOD_CAMERA, WORLD_PALETTE, WORLD_SCALE } from "../3d/world-theme";
import {
  carSpots,
  pedestrianCrossings,
  pedestrianSpots,
  roadMarkings,
  sidewalksAndCurbs,
  streetLightSpots,
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
  actorPositions,
  actorRoutes,
  playerPositions,
  occupiedFootprints,
  sceneBounds,
  onSelect,
  onArrive,
}: {
  npc: NeighborhoodNpcView;
  start: [number, number, number];
  target: [number, number, number];
  actorPositions: MutableRefObject<Map<string, NpcPoint>>;
  actorRoutes: React.MutableRefObject<Map<string, readonly NpcPoint[]>>;
  playerPositions: readonly (readonly [number, number, number])[];
  occupiedFootprints: readonly { left: number; top: number; width: number; height: number }[];
  sceneBounds: { left: number; top: number; width: number; height: number };
  onSelect: () => void;
  onArrive: () => void;
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
  const targetKey = `${target[0].toFixed(2)}:${target[2].toFixed(2)}`;
  const route = useRef<readonly NpcPoint[]>([]);
  const waypointIndex = useRef(0);
  const targetKeyRef = useRef("");
  const blockedFor = useRef(0);
  const retryAfter = useRef(neighborhoodNpcReplanDelay(npc.id));
  const arrivedTarget = useRef<string | null>(null);
  const bias = neighborhoodNpcAvoidanceBias(npc.id);
  const targetX = target[0];
  const targetZ = target[2];

  const startX = start[0];
  const startY = start[1];
  const startZ = start[2];
  const rebuildRoute = useCallback(
    (origin: NpcPoint) => {
      const reservations = [...actorRoutes.current.entries()]
        .filter(([id, path]) => id !== npc.id && path.length > 1)
        .map(([, path]) => path);

      const next = neighborhoodNpcPathWithFallback(
        origin,
        { x: targetX, y: targetZ },
        occupiedFootprints,
        sceneBounds,
        reservations,
        (NEIGHBORHOOD_TILE_SIZE * WORLD_SCALE.neighborhoodUnit) / 2,
      );

      route.current = next ?? [origin];
      waypointIndex.current = 0;
      blockedFor.current = 0;
      targetKeyRef.current = targetKey;

      if (route.current.length > 1) {
        actorRoutes.current.set(npc.id, neighborhoodNpcReservationPath(origin, route.current));
      } else {
        actorRoutes.current.delete(npc.id);
      }
    },
    [actorRoutes, npc.id, occupiedFootprints, sceneBounds, targetX, targetZ, targetKey],
  );

  useEffect(() => {
    const actor = group.current;
    if (!actor) return;

    const current = {
      x: actor.position.x,
      y: actor.position.z,
    };

    if (targetKeyRef.current !== targetKey || route.current.length === 0) {
      rebuildRoute(current);
    }
  }, [rebuildRoute, targetKey, startX, startZ]);

  useEffect(() => {
    const actor = group.current;
    if (!actor) return;

    // Apply authoritative spawn/confirmed-position updates only when they differ
    // materially; ordinary parent renders must not snap a walking actor backwards.
    const known = actorPositions.current.get(npc.id);

    if (!known || Math.hypot(known.x - startX, known.y - startZ) > 1.5) {
      actor.position.set(startX, startY, startZ);
      actorPositions.current.set(npc.id, {
        x: startX,
        y: startZ,
      });

      rebuildRoute({ x: startX, y: startZ });
      invalidate();
    }
  }, [actorPositions, invalidate, npc.id, rebuildRoute, startX, startY, startZ]);

  useEffect(() => {
    if (!animated) return;

    const timer = window.setInterval(invalidate, 1000 / 15);

    return () => window.clearInterval(timer);
  }, [animated, invalidate]);
  useEffect(
    () => () => {
      actorPositions.current.delete(npc.id);
      actorRoutes.current.delete(npc.id);
    },
    [actorPositions, actorRoutes, npc.id],
  );

  useFrame((state, delta) => {
    const actor = group.current;
    if (!actor || npc.isPaused) return;
    const current = { x: actor.position.x, y: actor.position.z };
    if (targetKeyRef.current !== targetKey) rebuildRoute(current);
    const waypoint = route.current[waypointIndex.current] ?? { x: target[0], y: target[2] };
    const distance = Math.hypot(waypoint.x - current.x, waypoint.y - current.y);
    const walking = distance > 0.035;
    if (walking) {
      arrivedTarget.current = null;
      const desiredStep = Math.min(
        distance,
        (1 - Math.exp(-Math.min(delta, 0.1) * 2.8)) * distance,
      );
      const blockers = [
        ...[...actorPositions.current.entries()]
          .filter(([id]) => id !== npc.id)
          .map(([, position]) => position),
        ...playerPositions.map((position) => ({ x: position[0], y: position[2] })),
      ];
      const next = neighborhoodNpcAvoidanceStep(
        current,
        waypoint,
        blockers,
        desiredStep,
        NEIGHBORHOOD_NPC_ACTOR_SEPARATION,
        occupiedFootprints,
        sceneBounds,
        bias,
      );
      const moved = Math.hypot(next.x - current.x, next.y - current.y);
      if (moved > 0.0001) {
        actor.position.x = next.x;
        actor.position.z = next.y;
        actor.rotation.y = Math.atan2(next.x - current.x, next.y - current.y);
        blockedFor.current = 0;
        retryAfter.current = neighborhoodNpcReplanDelay(npc.id);
        actorPositions.current.set(npc.id, next);
      } else {
        blockedFor.current += Math.min(delta, 0.1);
        if (blockedFor.current >= retryAfter.current) {
          rebuildRoute(current);
          retryAfter.current = Math.min(retryAfter.current * 1.6, 8);
        }
      }
      if (Math.hypot(waypoint.x - actor.position.x, waypoint.y - actor.position.z) <= 0.12) {
        waypointIndex.current += 1;
        if (waypointIndex.current >= route.current.length) {
          actor.position.x = target[0];
          actor.position.z = target[2];
          actorPositions.current.set(npc.id, { x: target[0], y: target[2] });
          actorRoutes.current.delete(npc.id);
        } else {
          actorRoutes.current.set(
            npc.id,
            neighborhoodNpcReservationPath(
              { x: actor.position.x, y: actor.position.z },
              route.current,
              waypointIndex.current,
            ),
          );
        }
      }
    } else {
      actor.position.x = target[0];
      actor.position.z = target[2];
      actorPositions.current.set(npc.id, { x: target[0], y: target[2] });
      actorRoutes.current.delete(npc.id);
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

/** Distant towers that frame the neighbourhood, so the open ground reads as a city. */
const SKY_FOG_NEAR_SCALE = 3.5;
const SKY_FOG_FAR_SCALE = 9;
/** Whether an obstacle sits inside a real model's footprint, so its procedural stand-in is skipped. */
function insideEnvironment(
  environment: { x: number; y: number; width: number; height: number } | undefined,
  obstacle: { x: number; y: number },
) {
  if (!environment) return false;
  return (
    Math.abs(obstacle.x - environment.x) <= environment.width / 2 &&
    Math.abs(obstacle.y - environment.y) <= environment.height / 2
  );
}

function NeighborhoodEnvironment({
  url,
  position,
  width,
}: {
  url: string;
  position: [number, number, number];
  width: number;
}) {
  const gltf = useGLTF(url);
  const fitted = useMemo(() => fitFurniture(gltf.scene, width), [gltf.scene, width]);
  return (
    <primitive
      object={fitted.copy}
      scale={fitted.scale}
      position={[
        position[0] + fitted.offset[0],
        position[1] + fitted.offset[1],
        position[2] + fitted.offset[2],
      ]}
    />
  );
}

export function R3FNeighborhoodSurface({
  players,
  selfSessionId,
  district,
  npcs,
  interactionTargets,
  onSelectTarget,
  onNpcArrive,
  onScene,
  zoom,
  onZoomChange,
  onGroundTap,
  groundTarget,
  commuteTarget = null,
}: {
  onGroundTap: (point: { x: number; y: number }) => void;
  groundTarget: { x: number; y: number } | null;
  /** Workplace beacon during an automatic commute; separate from the tapped destination. */
  commuteTarget?: { x: number; y: number } | null;
  players: readonly NeighborhoodPlayerView[];
  npcs: readonly NeighborhoodNpcView[];
  interactionTargets: readonly NeighborhoodObject[];
  onSelectTarget: (targetId: string) => void;
  onNpcArrive: (npcId: string, x: number, y: number) => void;
  selfSessionId: string;
  homeTypeId: string | null;
  district: NonNullable<ReturnType<typeof playableDistrictForLocation>>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onScene: (scene: NeighborhoodSceneHandle | null) => void;
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
          Math.max(
            NEIGHBORHOOD_CAMERA.minZoom,
            Math.min(NEIGHBORHOOD_CAMERA.maxZoom, zoomRef.current * factor),
          ),
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
    return {
      markings: roadMarkings(area, bounds),
      sidewalks: kerbs.sidewalks,
      curbs: kerbs.curbs,
      crossings: pedestrianCrossings(area),
      lights: streetLightSpots(area, bounds),
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
    return {
      markings: flat(dressing.markings, 0.07, 0.03),
      crossings: flat(dressing.crossings, 0.07, 0.03),
      sidewalks: flat(dressing.sidewalks, 0.05, 0.1),
      curbs: flat(dressing.curbs, 0.09, 0.14),
      lights: onGround(dressing.lights),
      cars: onGround(dressing.cars),
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
  const actorPositions = useRef(new Map<string, NpcPoint>());
  const actorRoutes = useRef(new Map<string, readonly NpcPoint[]>());
  const movementBounds = useMemo(
    () => ({
      left: (-bounds.width * unit) / 2,
      top: (-bounds.height * unit) / 2,
      width: bounds.width * unit,
      height: bounds.height * unit,
    }),
    [bounds.width, bounds.height, unit],
  );
  const movementObstacles = useMemo(() => {
    const footprints = [
      ...area.objects.filter((object) => object.kind !== "npc").map(neighborhoodBuildingFootprint),
      ...(area.obstacles ?? []).map(neighborhoodObstacleFootprint),
    ];
    return footprints.map((footprint) => {
      const center = point(
        footprint.left + footprint.width / 2,
        footprint.top + footprint.height / 2,
      );
      return {
        left: center[0] - (footprint.width * unit) / 2,
        top: center[2] - (footprint.height * unit) / 2,
        width: footprint.width * unit,
        height: footprint.height * unit,
      };
    });
  }, [area, point, unit]);
  const self = players.find((player) => player.sessionId === selfSessionId);
  const selfPoint = self && toScene(self, district.origin);
  const target: [number, number, number] =
    follow && selfPoint ? point(selfPoint.x, selfPoint.y) : [0, 0, 0];
  const occlusionSubject = selfPoint
    ? ([
        point(selfPoint.x, selfPoint.y)[0],
        WORLD_SCALE.character,
        point(selfPoint.x, selfPoint.y)[2],
      ] as const)
    : null;
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
            width={bounds.width * unit}
            depth={bounds.height * unit}
            target={target}
            zoom={zoom}
            minZoom={NEIGHBORHOOD_CAMERA.minZoom}
            maxZoom={NEIGHBORHOOD_CAMERA.maxZoom}
            onZoomChange={onZoomChange}
          />
          <WorldLighting size={Math.max(bounds.width, bounds.height) * unit} animateFoliage />
          <color attach="background" args={[WORLD_PALETTE.sky]} />
          <fog
            attach="fog"
            args={[
              WORLD_PALETTE.sky,
              Math.max(bounds.width, bounds.height) * unit * SKY_FOG_NEAR_SCALE,
              Math.max(bounds.width, bounds.height) * unit * SKY_FOG_FAR_SCALE,
            ]}
          />
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

          {area.environment && (
            <Suspense fallback={null}>
              <NeighborhoodEnvironment
                url={area.environment.url}
                position={point(area.environment.x, area.environment.y)}
                width={area.environment.width * unit}
              />
            </Suspense>
          )}
          {area.obstacles
            ?.filter((o) => ["compound", "shop", "kiosk"].includes(o.kind))
            .filter((o) => !insideEnvironment(area.environment, o))
            .map((o) => (
              <WorldHouse
                detailed
                key={o.id}
                position={point(o.x, o.y)}
                width={o.width * unit}
                depth={o.height * unit}
                height={WORLD_SCALE.neighborhoodBuildingHeight}
                shop={o.kind !== "compound"}
                variant={
                  o.kind === "compound" ? "residential" : o.kind === "kiosk" ? "market" : "services"
                }
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
                ...(o.label !== undefined ? { label: o.label } : {}),
              }))}
          />
          {area.obstacles
            ?.filter((obstacle) => obstacle.kind === "landmark" && obstacle.label)
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
                          : "services"
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
              actorPositions={actorPositions}
              actorRoutes={actorRoutes}
              playerPositions={scenePoints}
              occupiedFootprints={movementObstacles}
              sceneBounds={movementBounds}
              onSelect={() => onSelectTarget(npc.id)}
              onArrive={() => onNpcArrive(npc.id, npc.targetX, npc.targetY)}
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
          {groundTarget && <WaypointBeacon position={point(groundTarget.x, groundTarget.y)} />}
          {commuteTarget && <WaypointBeacon position={point(commuteTarget.x, commuteTarget.y)} />}
          {occlusionSubject && <BuildingOcclusion subject={occlusionSubject} />}
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
              const p = point(target.x, target.y);
              const footprint =
                target.kind === "npc" ? null : neighborhoodBuildingFootprint(target);
              return (
                <mesh
                  key={target.id}
                  position={[p[0], 1.3, p[2]]}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTarget(target.id);
                  }}
                >
                  {target.kind === "npc" ? (
                    <cylinderGeometry args={[0.58, 0.58, 2.6, 12]} />
                  ) : (
                    <boxGeometry args={[footprint!.width * unit, 2.6, footprint!.height * unit]} />
                  )}
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
