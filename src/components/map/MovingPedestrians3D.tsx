import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import type { TownMobilityRoute } from "@/game/town-mobility";

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
  greeting: string;
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
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
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
  const npcs: NpcConfig[] = paths.map((path, index) => ({
    id: `town-pedestrian-${index}`,
    name: `Neighbour ${index + 1}`,
    role: roles[index % roles.length]!,
    color: clothingColors[index % clothingColors.length]!,
    speed: 0.09 + (index % 4) * 0.025,
    path,
    greeting: greetings[index % greetings.length]!,
  }));

  return (
    <group>
      {npcs.map((npc) => (
        <PedestrianCharacter
          key={npc.id}
          npc={npc}
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
  onInteract,
  isSpeaking,
  speechText,
}: {
  npc: NpcConfig;
  onInteract: (text: string) => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const currentSegment = useRef(0);
  const travelDirection = useRef(1);
  const progress = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const routeLength = useMemo(() => pathLength(npc.path), [npc.path]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = npc;
    if (path.length < 2) return;

    if (routeLength < 0.001) return;

    // Pedestrians walk to each end of their sidewalk run, then turn around.
    // Preserve leftover frame time at segment boundaries and cap long pauses
    // to one round trip so they never skip across the town.
    let distanceToTravel = (speed * Math.max(0, delta) * 6) % (routeLength * 2);

    while (distanceToTravel > 0) {
      const nextIndex = currentSegment.current + travelDirection.current;
      if (nextIndex < 0 || nextIndex >= path.length) {
        travelDirection.current *= -1;
        continue;
      }

      const start = path[currentSegment.current]!;
      const end = path[nextIndex]!;
      const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);

      if (segmentLength < 0.001) {
        currentSegment.current = nextIndex;
        continue;
      }

      const remainingOnSegment = segmentLength * (1 - progress.current);
      if (distanceToTravel >= remainingOnSegment) {
        distanceToTravel -= remainingOnSegment;
        currentSegment.current = nextIndex;
        progress.current = 0;
        if (currentSegment.current === 0 || currentSegment.current === path.length - 1) {
          travelDirection.current *= -1;
        }
      } else {
        progress.current += distanceToTravel / segmentLength;
        distanceToTravel = 0;
      }
    }

    const curP1 = path[currentSegment.current]!;
    const followingIndex = currentSegment.current + travelDirection.current;
    const curP2 = path[followingIndex]!;
    const curDx = curP2[0] - curP1[0];
    const curDz = curP2[1] - curP1[1];

    const posX = curP1[0] + curDx * progress.current;
    const posZ = curP1[1] + curDz * progress.current;
    const angle = Math.atan2(curDx, curDz);

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


function pathLength(path: TownMobilityRoute): number {
  return path.slice(1).reduce((total, point, index) => {
    const previous = path[index]!;
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}
