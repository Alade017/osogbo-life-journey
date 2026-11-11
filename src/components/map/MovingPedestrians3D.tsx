import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { isValidTownPedestrianRoute, townPedestrianClearanceRadius, TownPedestrianJunctionScheduler, type TownMobilityRoute } from "@/game/town-mobility";

export interface MovingPedestrians3DProps {
  paths: readonly TownMobilityRoute[];
}

interface NpcConfig {
  id: string;
  name: string;
  role: "trader" | "student" | "resident" | "elder";
  color: string;
  speed: number;
  path: TownMobilityRoute;
  startDistance: number;
  greeting: string;
  startJunctionId?: string;
  endJunctionId?: string;
}

/**
 * Animated 3D Pedestrian System.
 * Brings the streets of Osogbo to life with moving NPCs:
 * - Market traders carrying baskets
 * - School students walking with backpacks
 * - Residents commuting in colorful attire
 * - Footstep bobbing animations and interactive dialogue bubbles.
 */
export const MovingPedestrians3D: FC<MovingPedestrians3DProps> = ({ paths }) => {
  const [activeSpeech, setActiveSpeech] = useState<{ id: string; text: string } | null>(null);
  const junctionScheduler = useMemo(() => new TownPedestrianJunctionScheduler(), []);
  const endpointCounts = useMemo(() => {
    const counts = new Map<string, number>();
    paths.forEach((path) => {
      if (path.length < 2) return;
      const endpointKeys = new Set([junctionKey(path[0]!), junctionKey(path[path.length - 1]!)]);
      endpointKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
    });
    return counts;
  }, [paths]);
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

  const roles: NpcConfig["role"][] = ["trader", "student", "resident", "elder"];
  const clothingColors = ["#ea580c", "#2563eb", "#16a34a", "#c026d3"];
  const greetings = [
    "E kaasan! Welcome to the neighbourhood.",
    "Good day! Enjoy your walk around town.",
    "As-salamu alaykum! Have a peaceful day.",
    "Hello! Lovely to see you around town.",
  ];
  const npcs: NpcConfig[] = paths.filter(isValidTownPedestrianRoute).map((path, index) => {
    const startJunctionId = endpointCounts.get(junctionKey(path[0]!))! > 1
      ? junctionKey(path[0]!)
      : undefined;
    const endJunctionId = endpointCounts.get(junctionKey(path[path.length - 1]!))! > 1
      ? junctionKey(path[path.length - 1]!)
      : undefined;
    const length = pathLength(path);
    const desiredStart = length * (((index + 1) * 0.61803398875) % 1);
    const clearance = townPedestrianClearanceRadius(length);
    const safeStart = startJunctionId ? clearance : 0;
    const safeEnd = endJunctionId ? length - clearance : length;

    return {
      id: `town-pedestrian-${path.map(([x, z]) => `${x.toFixed(3)},${z.toFixed(3)}`).join("|")}`,
      name: `Neighbour ${index + 1}`,
      role: roles[index % roles.length]!,
      color: clothingColors[index % clothingColors.length]!,
      speed: 0.09 + (index % 4) * 0.025,
      path,
      startDistance: safeEnd >= safeStart
        ? Math.min(Math.max(desiredStart, safeStart), safeEnd)
        : length / 2,
      greeting: greetings[index % greetings.length]!,
      startJunctionId,
      endJunctionId,
    };
  });

  return (
    <group>
      {npcs.map((npc) => (
        <PedestrianCharacter
          key={npc.id}
          npc={npc}
          junctionScheduler={junctionScheduler}
          onInteract={(text) => showSpeech(npc.id, text, 3000)}
          isSpeaking={activeSpeech?.id === npc.id}
          speechText={activeSpeech?.text}
        />
      ))}
    </group>
  );
};

function PedestrianCharacter({
  npc,
  junctionScheduler,
  onInteract,
  isSpeaking,
  speechText,
}: {
  npc: NpcConfig;
  junctionScheduler: TownPedestrianJunctionScheduler;
  onInteract: (text: string) => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const routeLength = useMemo(() => pathLength(npc.path), [npc.path]);
  const routeDistance = useRef(npc.startDistance);
  const travelDirection = useRef(1);
  const activeJunction = useRef<string | null>(null);
  const clearanceRadius = townPedestrianClearanceRadius(routeLength);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => () => {
    junctionScheduler.release(npc.startJunctionId ?? "", npc.id);
    junctionScheduler.release(npc.endJunctionId ?? "", npc.id);
  }, [junctionScheduler, npc.id, npc.startJunctionId, npc.endJunctionId]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = npc;
    if (path.length < 2) return;

    if (!Number.isFinite(routeLength) || routeLength < 0.001) return;
    if (!Number.isFinite(delta) || delta <= 0) return;

    // Advance along the route while reserving shared endpoints before entering
    // their clearance zone. A pedestrian waits just short of the junction.
    let distanceToTravel = (speed * Math.max(0, delta) * 6) % (routeLength * 2);
    let safetyIterations = 0;

    while (distanceToTravel > 0 && safetyIterations++ < path.length * 4 + 8) {
      const destinationIsEnd = travelDirection.current > 0;
      const junctionId = destinationIsEnd ? npc.endJunctionId : npc.startJunctionId;
      const distanceToJunction = destinationIsEnd
        ? routeLength - routeDistance.current
        : routeDistance.current;
      const distanceFromReservedJunction = activeJunction.current === npc.startJunctionId
        && activeJunction.current === npc.endJunctionId
        ? Math.min(routeDistance.current, routeLength - routeDistance.current)
        : activeJunction.current === npc.startJunctionId
          ? routeDistance.current
          : activeJunction.current === npc.endJunctionId
            ? routeLength - routeDistance.current
            : Number.POSITIVE_INFINITY;

      if (activeJunction.current && distanceFromReservedJunction > clearanceRadius) {
        junctionScheduler.release(activeJunction.current, npc.id);
        activeJunction.current = null;
      }

      if (junctionId && activeJunction.current !== junctionId
        && distanceToJunction <= clearanceRadius + distanceToTravel) {
        if (!junctionScheduler.request(junctionId, npc.id)) {
          const safeAdvance = Math.max(0, distanceToJunction - clearanceRadius);
          routeDistance.current += travelDirection.current * Math.min(distanceToTravel, safeAdvance);
          distanceToTravel = 0;
          break;
        }
        activeJunction.current = junctionId;
      }

      const distanceToRouteEnd = destinationIsEnd ? routeLength - routeDistance.current : routeDistance.current;
      const step = Math.min(distanceToTravel, Math.max(0, distanceToRouteEnd));
      routeDistance.current += travelDirection.current * step;
      distanceToTravel -= step;

      if (distanceToRouteEnd <= step + 0.000001) {
        travelDirection.current *= -1;
        if (step < 0.000001) break;
      } else {
        break;
      }
    }

    // Resolve the current route segment for rendering after movement is updated.
    const position = locatePathDistance(path, routeDistance.current);
    const currentSegment = position.segment;
    const curP1 = path[currentSegment]!;
    const curP2 = path[currentSegment + 1]!;
    const curDx = curP2[0] - curP1[0];
    const curDz = curP2[1] - curP1[1];
    const posX = curP1[0] + curDx * position.progress;
    const posZ = curP1[1] + curDz * position.progress;
    const angle = Math.atan2(curDx * travelDirection.current, curDz * travelDirection.current);

    // Natural footstep bobbing
    const t = clock.getElapsedTime();
    const footstepBob = Math.abs(Math.sin(t * 7.5)) * 0.012;

    // The trouser mesh begins 0.03 units above the character origin.
    // Match that base to the sidewalk top (0.06) without an extra parent lift.
    groupRef.current.position.set(posX, 0.03 + footstepBob, posZ);
    // Ease heading changes around corners instead of snapping at segment boundaries.
    const currentAngle = groupRef.current.rotation.y;
    const angleDifference = Math.atan2(
      Math.sin(angle - currentAngle),
      Math.cos(angle - currentAngle),
    );
    groupRef.current.rotation.y = currentAngle + angleDifference * (1 - Math.exp(-12 * Math.max(0, delta)));
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onInteract(npc.greeting);
      }}
      onPointerEnter={() => {
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setIsHovered(false);
        document.body.style.cursor = "auto";
      }}
      scale={isHovered ? 1.25 : 1.0}
    >
      {/* Head */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.11, 10, 10]} />
        <WorldMaterial tone="timber" />
      </mesh>

      {/* Body / Torso Clothes */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.22, 0.32, 0.14]} />
        <meshStandardMaterial color={npc.color} roughness={0.6} />
      </mesh>

      {/* Trousers / Wrapper */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.2, 0.22, 0.12]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* Accessories */}
      {npc.role === "trader" && (
        /* Woven market basket on head */
        <mesh position={[0, 0.77, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.14, 0.14, 12]} />
          <meshStandardMaterial color="#b45309" roughness={0.8} />
        </mesh>
      )}

      {npc.role === "student" && (
        /* Blue School Backpack */
        <mesh position={[0, 0.4, -0.1]} castShadow>
          <boxGeometry args={[0.16, 0.22, 0.09]} />
          <meshStandardMaterial color="#0284c7" roughness={0.5} />
        </mesh>
      )}

      {/* Interactive Greeting Speech Bubble */}
      {isSpeaking && speechText && (
        <Html center position={[0, 1.1, 0]} distanceFactor={12}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              color: "#ffffff",
              border: `1.5px solid ${npc.color}`,
              borderRadius: "10px",
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 18px rgba(0,0,0,0.7)",
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


function junctionKey(point: readonly [number, number]): string {
  return `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
}

function pathLength(path: TownMobilityRoute): number {
  return path.slice(1).reduce((total, point, index) => {
    const previous = path[index]!;
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}

function locatePathDistance(path: TownMobilityRoute, distance: number): { segment: number; progress: number } {
  if (path.length < 2) return { segment: 0, progress: 0 };
  let remaining = Math.max(0, distance);
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!;
    const end = path[index + 1]!;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (length < 0.001) continue;
    if (remaining <= length) return { segment: index, progress: remaining / length };
    remaining -= length;
  }
  return { segment: path.length - 2, progress: 1 };
}
