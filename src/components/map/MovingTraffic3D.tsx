import { useRef, useState, type FC } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";

export interface MovingTraffic3DProps {
  cellSize: number;
  gridCols: number;
  gridRows: number;
}

type VehicleType = "danfo" | "keke" | "okada" | "taxi";

interface VehicleConfig {
  id: string;
  type: VehicleType;
  name: string;
  description: string;
  speed: number;
  path: [number, number][]; // [x, z] waypoints
  color: string;
}

/**
 * Animated and Interactive 3D Traffic System.
 * Simulates living Nigerian transit in Osogbo:
 * - Yellow Danfo commuter buses with classic black stripes
 * - Commercial Keke Napep tricycles
 * - Agile Okada motorcycles
 * - Interactive click/hover dialogs and horn feedback.
 */
export const MovingTraffic3D: FC<MovingTraffic3DProps> = ({ cellSize, gridCols, gridRows }) => {
  const [activeSpeech, setActiveSpeech] = useState<{ id: string; text: string } | null>(null);

  const xMax = (gridCols / 2 - 2) * cellSize;
  const zMax = (gridRows / 2 - 2) * cellSize;

  // Realistic transit routes across the road grid
  const vehicles: VehicleConfig[] = [
    {
      id: "danfo-1",
      type: "danfo",
      name: "Danfo Bus #101",
      description: "Olaiya Junction ⇄ Oja-Oba Market Express",
      speed: 0.16,
      path: [
        [-xMax * 0.8, -zMax * 0.4],
        [xMax * 0.8, -zMax * 0.4],
        [xMax * 0.8, zMax * 0.4],
        [-xMax * 0.8, zMax * 0.4],
      ],
      color: "#eab308",
    },
    {
      id: "danfo-2",
      type: "danfo",
      name: "Danfo Bus #204",
      description: "Transit Park ⇄ East Gate Terminal",
      speed: 0.14,
      path: [
        [xMax * 0.7, zMax * 0.6],
        [-xMax * 0.7, zMax * 0.6],
        [-xMax * 0.7, -zMax * 0.6],
        [xMax * 0.7, -zMax * 0.6],
      ],
      color: "#f59e0b",
    },
    {
      id: "keke-1",
      type: "keke",
      name: "Keke Napep",
      description: "Local Market Shuttle (₦100 per drop)",
      speed: 0.22,
      path: [
        [-xMax * 0.4, zMax * 0.2],
        [0, zMax * 0.2],
        [0, -zMax * 0.2],
        [-xMax * 0.4, -zMax * 0.2],
      ],
      color: "#16a34a",
    },
    {
      id: "okada-1",
      type: "okada",
      name: "Commercial Okada",
      description: "Fast junction crosser · Quick ride",
      speed: 0.28,
      path: [
        [-xMax * 0.6, 0],
        [xMax * 0.6, 0],
        [xMax * 0.6, zMax * 0.5],
        [-xMax * 0.6, zMax * 0.5],
      ],
      color: "#dc2626",
    },
  ];

  return (
    <group position={[0, 0.08, 0]}>
      {vehicles.map((v) => (
        <TrafficVehicle
          key={v.id}
          config={v}
          cellSize={cellSize}
          onInteract={(text) => {
            setActiveSpeech({ id: v.id, text });
            setTimeout(() => setActiveSpeech(null), 3200);
          }}
          isSpeaking={activeSpeech?.id === v.id}
          speechText={activeSpeech?.text}
        />
      ))}
    </group>
  );
};

function TrafficVehicle({
  config,
  cellSize,
  onInteract,
  isSpeaking,
  speechText,
}: {
  config: VehicleConfig;
  cellSize: number;
  onInteract: (text: string) => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const currentSegment = useRef(0);
  const progress = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = config;
    const p1 = path[currentSegment.current]!;
    const nextIdx = (currentSegment.current + 1) % path.length;
    const p2 = path[nextIdx]!;

    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const segmentLength = Math.hypot(dx, dz);

    progress.current += (speed * delta * cellSize * 4) / Math.max(segmentLength, 0.1);

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

    groupRef.current.position.set(posX, 0.05, posZ);
    groupRef.current.rotation.y = angle;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const beeps = [
      "📯 Peep peep! Clear the road!",
      "🚖 Entering Olaiya junction!",
      "💨 Moving briskly!",
    ];
    const randomMsg = beeps[Math.floor(Math.random() * beeps.length)]!;
    onInteract(`${config.name}: ${randomMsg}`);
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
              <mesh
                key={`wheel-${wx}-${wz}`}
                position={[wx, 0.12, wz]}
                rotation={[0, 0, Math.PI / 2]}
              >
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
