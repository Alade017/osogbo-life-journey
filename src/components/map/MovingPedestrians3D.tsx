import { useEffect, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";

export interface MovingPedestrians3DProps {
  cellSize: number;
  gridCols: number;
  gridRows: number;
}

interface NpcConfig {
  id: string;
  name: string;
  role: "trader" | "student" | "resident" | "elder";
  color: string;
  speed: number;
  path: [number, number][];
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
export const MovingPedestrians3D: FC<MovingPedestrians3DProps> = ({
  cellSize,
  gridCols,
  gridRows,
}) => {
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

  const xMax = (gridCols / 2 - 3) * cellSize;
  const zMax = (gridRows / 2 - 3) * cellSize;

  const npcs: NpcConfig[] = [
    {
      id: "npc-trader-1",
      name: "Iya Oja",
      role: "trader",
      color: "#ea580c",
      speed: 0.12,
      path: [
        [-xMax * 0.7, zMax * 0.3],
        [-xMax * 0.2, zMax * 0.3],
        [-xMax * 0.2, zMax * 0.6],
        [-xMax * 0.7, zMax * 0.6],
      ],
      greeting: "🧺 E kaasan! Fresh yams and peppers at Oja Oba!",
    },
    {
      id: "npc-student-1",
      name: "Tunde",
      role: "student",
      color: "#2563eb",
      speed: 0.18,
      path: [
        [0, -zMax * 0.5],
        [xMax * 0.5, -zMax * 0.5],
        [xMax * 0.5, -zMax * 0.2],
        [0, -zMax * 0.2],
      ],
      greeting: "🎒 On my way to the School of Art!",
    },
    {
      id: "npc-resident-1",
      name: "Alhaji Bello",
      role: "elder",
      color: "#16a34a",
      speed: 0.09,
      path: [
        [-xMax * 0.3, -zMax * 0.3],
        [xMax * 0.3, -zMax * 0.3],
        [xMax * 0.3, 0],
        [-xMax * 0.3, 0],
      ],
      greeting: "🕌 As-salamu alaykum! Heading towards the Grand Mosque.",
    },
    {
      id: "npc-resident-2",
      name: "Folake",
      role: "resident",
      color: "#c026d3",
      speed: 0.15,
      path: [
        [xMax * 0.4, zMax * 0.2],
        [xMax * 0.7, zMax * 0.2],
        [xMax * 0.7, zMax * 0.5],
        [xMax * 0.4, zMax * 0.5],
      ],
      greeting: "👋 Beautiful afternoon in Osogbo!",
    },
  ];

  return (
    <group position={[0, 0.05, 0]}>
      {npcs.map((npc) => (
        <PedestrianCharacter
          key={npc.id}
          npc={npc}
          cellSize={cellSize}
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
  cellSize,
  onInteract,
  isSpeaking,
  speechText,
}: {
  npc: NpcConfig;
  cellSize: number;
  onInteract: (text: string) => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const currentSegment = useRef(0);
  const progress = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = npc;
    const p1 = path[currentSegment.current]!;
    const nextIdx = (currentSegment.current + 1) % path.length;
    const p2 = path[nextIdx]!;

    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const segmentLength = Math.hypot(dx, dz);

    progress.current += (speed * delta * cellSize * 3) / Math.max(segmentLength, 0.1);

    if (progress.current >= 1.0) {
      progress.current = 0;
      currentSegment.current = nextIdx;
    }

    const curP1 = path[currentSegment.current]!;
    const curP2 = path[(currentSegment.current + 1) % path.length]!;
    const curDx = curP2[0] - curP1[0];
    const curDz = curP2[1] - curP1[1];

    const posX = curP1[0] + curDx * progress.current;
    const posZ = curP1[1] + curDz * progress.current;
    const angle = Math.atan2(curDx, curDz);

    // Natural footstep bobbing
    const t = clock.getElapsedTime();
    const footstepBob = Math.abs(Math.sin(t * 7.5)) * 0.06;

    groupRef.current.position.set(posX, 0.08 + footstepBob, posZ);
    groupRef.current.rotation.y = angle;
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
