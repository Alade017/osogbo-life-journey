import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { isValidTownMobilityLoop, measureTownMobilityLoop, townMobilityRouteIdentity, townRoadJunctionIdentity, TownRoadCrossingPriorityScheduler, type TownMobilityRoute } from "@/game/town-mobility";

export interface MovingTraffic3DProps {
  paths: readonly TownMobilityRoute[];
  crossingScheduler: TownRoadCrossingPriorityScheduler;
  onSelectTransit: () => void;
}

type VehicleType = "danfo" | "keke" | "okada" | "taxi";

interface VehicleConfig {
  id: string;
  type: VehicleType;
  name: string;
  description: string;
  speed: number;
  path: TownMobilityRoute;
  startDistance: number;
  color: string;
  junctionIds: readonly (string | null)[];
}

/**
 * Animated and Interactive 3D Traffic System.
 * Simulates living Nigerian transit in Osogbo:
 * - Yellow Danfo commuter buses with classic black stripes
 * - Commercial Keke Napep tricycles
 * - Agile Okada motorcycles
 * - Interactive click/hover dialogs and horn feedback.
 */
export const MovingTraffic3D: FC<MovingTraffic3DProps> = ({ paths, crossingScheduler, onSelectTransit }) => {
  const [activeSpeech, setActiveSpeech] = useState<{ id: string; text: string } | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    // Do not leave the page cursor in its interactive state if the map unmounts
    // while a vehicle or pedestrian is hovered.
    document.body.style.cursor = "auto";
  }, []);

  const showSpeech = (id: string, text: string, duration: number) => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    setActiveSpeech({ id, text });
    speechTimeoutRef.current = setTimeout(() => {
      setActiveSpeech((current) => current?.id === id ? null : current);
      speechTimeoutRef.current = null;
    }, duration);
  };

  const vehicleTypes: VehicleType[] = ["danfo", "keke", "okada", "taxi"];
  const vehicleColors: Record<VehicleType, string> = {
    danfo: "#eab308",
    keke: "#16a34a",
    okada: "#dc2626",
    taxi: "#2563eb",
  };
  const validPaths = paths.filter(isValidTownMobilityLoop);
  const junctionCounts = new Map<string, number>();
  for (const path of validPaths) {
    for (const [x, z] of path) {
      const key = townRoadJunctionIdentity(x, z);
      junctionCounts.set(key, (junctionCounts.get(key) ?? 0) + 1);
    }
  }
  const vehicles: VehicleConfig[] = validPaths.flatMap((path) => {
    const identity = townMobilityRouteIdentity(path);
    const numericIdentity = Number.parseInt(identity, 36);
    const routeLength = measureTownMobilityLoop(path);
    if (!identity || !Number.isFinite(numericIdentity) || routeLength < 0.001) return [];
    const type = vehicleTypes[numericIdentity % vehicleTypes.length]!;
    const junctionIds = path.map(([x, z]) => {
      const key = `${Math.round(x)},${Math.round(z)}`;
      return (junctionCounts.get(key) ?? 0) > 1 ? key : null;
    });
    return [{
      id: `town-traffic-${identity}`,
      type,
      name: `Town vehicle ${identity.toUpperCase()}`,
      description: "Following the connected town road network",
      speed: 0.14 + ((numericIdentity >>> 4) % 4) * 0.025,
      path,
      startDistance: ((numericIdentity >>> 8) / 0x1000000) * routeLength,
      color: vehicleColors[type],
      junctionIds,
    }];
  });

  return (
    <group position={[0, 0.08, 0]}>
      {vehicles.map((v) => (
        <TrafficVehicle
          key={v.id}
          config={v}
          crossingScheduler={crossingScheduler}
          onInteract={(text) => showSpeech(v.id, text, 3200)}
          onSelectTransit={onSelectTransit}
          isSpeaking={activeSpeech?.id === v.id}
          speechText={activeSpeech?.text}
        />
      ))}
    </group>
  );
};

function TrafficVehicle({
  config,
  crossingScheduler,
  onInteract,
  onSelectTransit,
  isSpeaking,
  speechText,
}: {
  config: VehicleConfig;
  crossingScheduler: TownRoadCrossingPriorityScheduler;
  onInteract: (text: string) => void;
  onSelectTransit: () => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const currentSegment = useRef(0);
  const progress = useRef(0);
  const activeJunction = useRef<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const routeLength = useMemo(() => measureTownMobilityLoop(config.path), [config.path]);

  useEffect(() => {
    const start = locateTrafficLoopDistance(config.path, config.startDistance);
    currentSegment.current = start.segment;
    progress.current = start.progress;
  }, [config.path, config.startDistance]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = config;
    if (path.length < 2 || !Number.isFinite(routeLength) || routeLength < 0.001) return;

    // Advance in world-space distance so crossing a corner never discards
    // leftover frame time. Modulo the cached loop length also bounds catch-up
    // work after a background-tab pause.
    if (!Number.isFinite(delta) || delta <= 0) return;
    let distanceToTravel = (speed * delta * 8) % routeLength;
    const nextJunction = config.junctionIds[(currentSegment.current + 1) % path.length] ?? null;
    const segmentStart = path[currentSegment.current]!;
    const segmentEnd = path[(currentSegment.current + 1) % path.length]!;
    const segmentLengthToJunction = Math.hypot(segmentEnd[0] - segmentStart[0], segmentEnd[1] - segmentStart[1]);
    const remainingToJunction = segmentLengthToJunction * (1 - progress.current);
    const clearanceDistance = Math.min(1.35, segmentLengthToJunction * 0.3);

    if (activeJunction.current && activeJunction.current !== nextJunction) {
      crossingScheduler.release(activeJunction.current, config.id);
      activeJunction.current = null;
    }
    if (nextJunction && remainingToJunction <= clearanceDistance + distanceToTravel) {
      if (!crossingScheduler.request(nextJunction, config.id, "vehicle")) {
        distanceToTravel = Math.min(distanceToTravel, Math.max(0, remainingToJunction - clearanceDistance));
        if (distanceToTravel <= 0) return;
      } else {
        activeJunction.current = nextJunction;
      }
    }

    let safetyIterations = 0;
    while (distanceToTravel > 0 && safetyIterations++ < path.length * 2 + 2) {
      const start = path[currentSegment.current]!;
      const end = path[(currentSegment.current + 1) % path.length]!;
      const segmentLength = [start[0], start[1], end[0], end[1]].every(Number.isFinite)
        ? Math.hypot(end[0] - start[0], end[1] - start[1])
        : 0;

      if (!Number.isFinite(segmentLength) || segmentLength < 0.001) {
        currentSegment.current = (currentSegment.current + 1) % path.length;
        progress.current = 0;
        continue;
      }

      const remainingOnSegment = segmentLength * (1 - progress.current);
      if (distanceToTravel >= remainingOnSegment) {
        distanceToTravel -= remainingOnSegment;
        currentSegment.current = (currentSegment.current + 1) % path.length;
        progress.current = 0;
      } else {
        progress.current += distanceToTravel / segmentLength;
        distanceToTravel = 0;
      }
    }

    const curP1 = path[currentSegment.current]!;
    const curP2 = path[(currentSegment.current + 1) % path.length]!;
    if (![curP1[0], curP1[1], curP2[0], curP2[1]].every(Number.isFinite)) return;
    const curDx = curP2[0] - curP1[0];
    const curDz = curP2[1] - curP1[1];

    const posX = curP1[0] + curDx * progress.current;
    const posZ = curP1[1] + curDz * progress.current;
    const angle = Math.atan2(curDx, curDz);

    groupRef.current.position.set(posX, 0.05, posZ);
    groupRef.current.rotation.y = angle;
    if (activeJunction.current && currentSegment.current !== (config.junctionIds.findIndex((id) => id === activeJunction.current) + path.length - 1) % path.length) {
      junctionScheduler.release(activeJunction.current, config.id);
      activeJunction.current = null;
    }
  });

  useEffect(() => () => {
    crossingScheduler.cancelActor(config.id);
  }, [config.id, crossingScheduler]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    const vehicleLabel = config.type === "danfo"
      ? "Danfo"
      : config.type === "keke"
        ? "Keke"
        : config.type === "okada"
          ? "Okada"
          : "Taxi";
    onInteract(`${vehicleLabel}: Opening the Transit Park travel options.`);
    onSelectTransit();
  };

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerEnter={() => {
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setIsHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Vehicle 3D Geometry */}
      {config.type === "danfo" && (
        <group scale={isHovered ? 1.15 : 1.0}>
          {/* Yellow Minibus Body */}
          <mesh position={[0, 0.38, 0]} castShadow>
            <boxGeometry args={[0.72, 0.58, 1.45]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Black Iconic Danfo Stripes */}
          {[-1, 1].map((side) => (
            <mesh key={`stripe-${side}`} position={[side * 0.365, 0.34, 0]}>
              <boxGeometry args={[0.01, 0.09, 1.4]} />
              <meshBasicMaterial color="#171717" />
            </mesh>
          ))}
          {/* Windshield & Windows */}
          <mesh position={[0, 0.44, 0.45]}>
            <boxGeometry args={[0.66, 0.28, 0.58]} />
            <meshStandardMaterial color="#0284c7" transparent opacity={0.7} roughness={0.1} />
          </mesh>
          {/* Headlights */}
          {[-0.24, 0.24].map((hx) => (
            <mesh key={`hl-${hx}`} position={[hx, 0.24, 0.73]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#fef08a" />
            </mesh>
          ))}
          {/* Wheels */}
          {[-0.34, 0.34].map((wx) =>
            [-0.45, 0.45].map((wz) => (
              <mesh key={`wheel-${wx}-${wz}`} position={[wx, 0.12, wz]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.12, 0.12, 0.08, 12]} />
                <meshStandardMaterial color="#1e293b" roughness={0.8} />
              </mesh>
            )),
          )}
        </group>
      )}

      {config.type === "keke" && (
        <group scale={isHovered ? 1.15 : 1.0}>
          {/* Tricycle Body */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.55, 0.46, 0.9]} />
            <meshStandardMaterial color={config.color} roughness={0.35} />
          </mesh>
          {/* Black Canvas Roof Canopy */}
          <mesh position={[0, 0.54, 0]}>
            <boxGeometry args={[0.58, 0.06, 0.94]} />
            <meshStandardMaterial color="#18181b" roughness={0.7} />
          </mesh>
          {/* 3 Wheels */}
          <mesh position={[0, 0.1, 0.42]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {[-0.26, 0.26].map((wx) => (
            <mesh key={`kw-${wx}`} position={[wx, 0.1, -0.32]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          ))}
        </group>
      )}

      {config.type === "okada" && (
        <group scale={isHovered ? 1.2 : 1.0}>
          {/* Bike Frame */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.14, 0.24, 0.65]} />
            <meshStandardMaterial color={config.color} metalness={0.6} />
          </mesh>
          {/* Rider Silhouette */}
          <mesh position={[0, 0.48, -0.06]} castShadow>
            <sphereGeometry args={[0.13, 10, 10]} />
            <WorldMaterial tone="timber" />
          </mesh>
          {/* Wheels */}
          {[-0.25, 0.25].map((wz) => (
            <mesh key={`okw-${wz}`} position={[0, 0.1, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 12]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          ))}
        </group>
      )}

      {config.type === "taxi" && (
        <group scale={isHovered ? 1.15 : 1.0}>
          {/* Compact four-door town taxi */}
          <mesh position={[0, 0.29, 0]} castShadow>
            <boxGeometry args={[0.64, 0.38, 1.18]} />
            <meshStandardMaterial color={config.color} roughness={0.38} metalness={0.12} />
          </mesh>
          {/* Raised passenger cabin */}
          <mesh position={[0, 0.55, -0.06]} castShadow>
            <boxGeometry args={[0.54, 0.3, 0.66]} />
            <meshStandardMaterial color={config.color} roughness={0.42} />
          </mesh>
          {/* Front and rear glass */}
          <mesh position={[0, 0.56, 0.28]}>
            <boxGeometry args={[0.48, 0.2, 0.025]} />
            <meshStandardMaterial color="#647f8c" roughness={0.18} metalness={0.12} />
          </mesh>
          <mesh position={[0, 0.56, -0.4]}>
            <boxGeometry args={[0.48, 0.2, 0.025]} />
            <meshStandardMaterial color="#647f8c" roughness={0.18} metalness={0.12} />
          </mesh>
          {/* Side windows */}
          {[-1, 1].map((side) => (
            <mesh key={`taxi-window-${side}`} position={[side * 0.276, 0.56, -0.06]}>
              <boxGeometry args={[0.018, 0.19, 0.55]} />
              <meshStandardMaterial color="#647f8c" roughness={0.18} metalness={0.12} />
            </mesh>
          ))}
          {/* Small roof taxi marker */}
          <mesh position={[0, 0.72, -0.06]} castShadow>
            <boxGeometry args={[0.22, 0.08, 0.16]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.55} />
          </mesh>
          {/* Four wheels */}
          {[-0.31, 0.31].map((wx) =>
            [-0.38, 0.38].map((wz) => (
              <mesh
                key={`taxi-wheel-${wx}-${wz}`}
                position={[wx, 0.12, wz]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[0.105, 0.105, 0.07, 12]} />
                <meshStandardMaterial color="#1e293b" roughness={0.82} />
              </mesh>
            )),
          )}
          {/* Front lamps */}
          {[-0.22, 0.22].map((x) => (
            <mesh key={`taxi-lamp-${x}`} position={[x, 0.3, 0.598]}>
              <boxGeometry args={[0.1, 0.055, 0.018]} />
              <meshBasicMaterial color="#fef08a" />
            </mesh>
          ))}
        </group>
      )}

      {/* Interactive Speech & Hail Bubble */}
      {isSpeaking && speechText && (
        <Html center position={[0, 1.2, 0]} distanceFactor={14}>
          <div
            style={{
              background: "#0f172a",
              color: "#fef08a",
              border: "1.5px solid #eab308",
              borderRadius: "10px",
              padding: "4px 9px",
              fontSize: "11px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              boxShadow: "0 6px 16px rgba(0,0,0,0.7)",
              pointerEvents: "none",
            }}
          >
            {speechText}
          </div>
        </Html>
      )}
    </group>
  );
}

function locateTrafficLoopDistance(
  path: TownMobilityRoute,
  distance: number,
): { segment: number; progress: number } {
  if (path.length < 2 || !Number.isFinite(distance) || distance <= 0) {
    return { segment: 0, progress: 0 };
  }

  let remaining = distance;
  for (let index = 0; index < path.length; index += 1) {
    const start = path[index]!;
    const end = path[(index + 1) % path.length]!;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (!Number.isFinite(segmentLength) || segmentLength < 0.001) continue;
    if (remaining < segmentLength) return { segment: index, progress: remaining / segmentLength };
    remaining -= segmentLength;
  }

  return { segment: 0, progress: 0 };
}
