import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { isValidTownMobilityLoop, measureTownMobilityLoop, type TownMobilityRoute } from "@/game/town-mobility";

export interface MovingTraffic3DProps {
  paths: readonly TownMobilityRoute[];
}

type VehicleType = "danfo" | "keke" | "okada" | "taxi";

interface VehicleConfig {
  id: string;
  type: VehicleType;
  name: string;
  description: string;
  speed: number;
  path: TownMobilityRoute;
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
export const MovingTraffic3D: FC<MovingTraffic3DProps> = ({ paths }) => {
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

  const vehicleTypes: VehicleType[] = ["danfo", "keke", "okada", "taxi"];
  const vehicleColors = ["#eab308", "#16a34a", "#dc2626", "#2563eb"];
  const vehicles: VehicleConfig[] = paths.filter(isValidTownMobilityLoop).map((path, index) => ({
    id: `town-traffic-${index}`,
    type: vehicleTypes[index % vehicleTypes.length]!,
    name: `Town vehicle ${index + 1}`,
    description: "Following the connected town road network",
    speed: 0.14 + (index % 4) * 0.025,
    path,
    color: vehicleColors[index % vehicleColors.length]!,
  }));

  return (
    <group position={[0, 0.08, 0]}>
      {vehicles.map((v) => (
        <TrafficVehicle
          key={v.id}
          config={v}
          onInteract={(text) => showSpeech(v.id, text, 3200)}
          isSpeaking={activeSpeech?.id === v.id}
          speechText={activeSpeech?.text}
        />
      ))}
    </group>
  );
};

function TrafficVehicle({
  config,
  onInteract,
  isSpeaking,
  speechText,
}: {
  config: VehicleConfig;
  onInteract: (text: string) => void;
  isSpeaking: boolean;
  speechText?: string | undefined;
}) {
  const groupRef = useRef<Group>(null);
  const currentSegment = useRef(0);
  const progress = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  useEffect(() => {
    currentSegment.current = 0;
    progress.current = 0;
  }, [config.path]);

  const routeLength = useMemo(() => measureTownMobilityLoop(config.path), [config.path]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const { path, speed } = config;
    if (path.length < 2 || !Number.isFinite(routeLength) || routeLength < 0.001) return;

    // Advance in world-space distance so crossing a corner never discards
    // leftover frame time. Modulo the cached loop length also bounds catch-up
    // work after a background-tab pause.
    if (!Number.isFinite(delta) || delta <= 0) return;
    let distanceToTravel = (speed * delta * 8) % routeLength;

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
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    const beeps = ["📯 Peep peep! Clear the road!", "🚖 Approaching the next junction!", "💨 Moving briskly!"];
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
