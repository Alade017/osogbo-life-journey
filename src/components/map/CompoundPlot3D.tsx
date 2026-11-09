import { useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group, type Mesh } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import type { MapProperty } from "./MapCanvas";

export interface CompoundPlot3DProps {
  property: MapProperty;
  cellSize?: number;
  isSelected?: boolean;
  isHovered?: boolean;
  isNight?: boolean;
  onClick?: (event: import("@react-three/fiber").ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void;
  onPointerOut?: () => void;
}

const STATUS_INDICATOR_COLORS: Record<MapProperty["status"], string> = {
  current: "#10b981", // Emerald: your active home
  rent_due: "#f59e0b", // Amber: rent due
  overdue: "#ef4444", // Red: overdue rent
  owned: "#0ea5e9", // Sky: owned property
  vacant: "#64748b", // Slate: vacant rental
};

/**
 * 3D residential compound and house visualization on the town map.
 * Assembles authentic, volumetric Nigerian residential compound architecture:
 * - Elevated concrete compound plinth
 * - Multi-story compound house with high corrugated roof pitch
 * - Overhead GeePee water storage tank on tall iron stanchion
 * - Soundproof generator house with exhaust pipe
 * - Concrete perimeter wall with entrance pillars and black iron gate
 * - Front veranda awning
 * - Illuminated window glow at night
 */
export const CompoundPlot3D: FC<CompoundPlot3DProps> = ({
  property,
  cellSize = 2,
  isSelected = false,
  isHovered = false,
  isNight = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const rootGroupRef = useRef<Group>(null);
  const statusLightRef = useRef<Mesh>(null);
  const targetScaleRef = useRef(new Vector3(1, 1, 1));

  const { type, tier, status, position, rotation = 0 } = property;

  // Substantially scaled up for prominent 3D presence on the map diorama
  const plotWidth = cellSize * 1.12;
  const plotDepth = cellSize * 1.12;
  const isMultiStory = tier === 3 || (tier === 2 && type === "flat");
  const houseWidth = plotWidth * (type === "compound" ? 0.72 : type === "shophouse" ? 0.65 : 0.58);
  const houseDepth = plotDepth * (type === "compound" ? 0.6 : type === "shophouse" ? 0.66 : 0.54);
  const houseHeight = cellSize * (isMultiStory ? 1.05 : 0.75);

  const statusColor = STATUS_INDICATOR_COLORS[status] ?? STATUS_INDICATOR_COLORS.vacant;
  const hasWaterTank = tier >= 2 || type === "compound";
  const hasGenerator = tier >= 2 || status === "current" || status === "owned";
  const hasSolar = tier === 3;
  const hasVeranda = type === "compound" || type === "shophouse" || tier >= 2;

  useFrame(({ clock }) => {
    if (!rootGroupRef.current) return;
    const t = clock.getElapsedTime();

    // Smooth hover elevation and scale
    const targetScale = isSelected ? 1.08 : isHovered ? 1.05 : 1.0;

    targetScaleRef.current.setScalar(targetScale);
    rootGroupRef.current.scale.lerp(targetScaleRef.current, 0.18);

    // Subtle beacon glow pulse
    if (statusLightRef.current) {
      const pulse = 0.85 + Math.sin(t * 3.5) * 0.2;
      statusLightRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group
      ref={rootGroupRef}
      position={position}
      rotation={[0, rotation, 0]}
      {...(onClick ? { onClick } : {})}
      {...(onPointerOver ? { onPointerOver } : {})}
      {...(onPointerOut ? { onPointerOut } : {})}
    >
      {/* 1. Raised Compound Yard Ground Foundation */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[plotWidth, 0.16, plotDepth]} />
        <WorldMaterial tone="concrete" />
      </mesh>

      {/* 2. Compound Perimeter Wall with Front Gate Gap */}
      <group position={[0, 0.32, 0]}>
        {/* Rear Wall */}
        <mesh position={[0, 0, -plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth, 0.44, 0.09]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Left Wall */}
        <mesh position={[-plotWidth * 0.48, 0, 0]} castShadow>
          <boxGeometry args={[0.09, 0.44, plotDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Right Wall */}
        <mesh position={[plotWidth * 0.48, 0, 0]} castShadow>
          <boxGeometry args={[0.09, 0.44, plotDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Front Left Wall Segment */}
        <mesh position={[-plotWidth * 0.3, 0, plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth * 0.36, 0.44, 0.09]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Front Right Wall Segment */}
        <mesh position={[plotWidth * 0.3, 0, plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth * 0.36, 0.44, 0.09]} />
          <WorldMaterial tone="wall" />
        </mesh>
      </group>

      {/* 3. Compound Gate Pillars & Black Iron Swing Gate */}
      <group position={[0, 0.36, plotDepth * 0.48]}>
        {/* Gate Pillars */}
        <mesh position={[-plotWidth * 0.12, 0.06, 0]} castShadow>
          <boxGeometry args={[0.13, 0.58, 0.13]} />
          <WorldMaterial tone="concrete" />
        </mesh>
        <mesh position={[plotWidth * 0.12, 0.06, 0]} castShadow>
          <boxGeometry args={[0.13, 0.58, 0.13]} />
          <WorldMaterial tone="concrete" />
        </mesh>
        {/* Iron Swing Gate */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[plotWidth * 0.22, 0.48, 0.03]} />
          <WorldMaterial tone="slate" />
        </mesh>
      </group>

      {/* 4. Main Volumetric House Structure */}
      <group position={[0, houseHeight / 2 + 0.16, -plotDepth * 0.05]}>
        {/* Main Walls */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[houseWidth, houseHeight, houseDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>

        {/* High Pitch Corrugated Eaves Roof */}
        <mesh
          position={[0, houseHeight / 2 + 0.22, 0]}
          rotation={[0, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[houseWidth + 0.22, 0.32, houseDepth + 0.22]} />
          <WorldMaterial tone={tier === 3 ? "accent" : status === "current" ? "roof" : "clay"} />
        </mesh>

        {/* Front Entrance Door */}
        <mesh position={[0, -houseHeight / 2 + 0.3, houseDepth / 2 + 0.025]}>
          <boxGeometry args={[houseWidth * 0.26, 0.58, 0.05]} />
          <WorldMaterial tone="timber" />
        </mesh>

        {/* Ground Floor Windows (Glow warm amber at night) */}
        {[-1, 1].map((side) => (
          <group
            key={`win-${side}`}
            position={[side * (houseWidth * 0.32), 0.04, houseDepth / 2 + 0.025]}
          >
            <mesh>
              <boxGeometry args={[houseWidth * 0.22, houseHeight * 0.26, 0.04]} />
              <WorldMaterial tone="windowFrame" />
            </mesh>
            <mesh position={[0, 0, 0.015]}>
              <boxGeometry args={[houseWidth * 0.18, houseHeight * 0.22, 0.02]} />
              <meshStandardMaterial
                color={isNight ? "#fef08a" : "#93c5fd"}
                emissive={isNight ? "#f59e0b" : "#000000"}
                emissiveIntensity={isNight ? 0.9 : 0}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Upper Floor Windows for Multi-Story Homes */}
        {isMultiStory &&
          [-1, 1].map((side) => (
            <mesh
              key={`upper-win-${side}`}
              position={[side * (houseWidth * 0.28), houseHeight * 0.28, houseDepth / 2 + 0.025]}
            >
              <boxGeometry args={[houseWidth * 0.2, houseHeight * 0.22, 0.03]} />
              <meshStandardMaterial
                color={isNight ? "#fef08a" : "#93c5fd"}
                emissive={isNight ? "#f59e0b" : "#000000"}
                emissiveIntensity={isNight ? 0.9 : 0}
                roughness={0.2}
              />
            </mesh>
          ))}
      </group>

      {/* 5. Shaded Front Veranda Awning */}
      {hasVeranda && (
        <group position={[0, houseHeight * 0.44 + 0.16, -plotDepth * 0.05 + houseDepth / 2 + 0.2]}>
          <mesh rotation={[-0.18, 0, 0]} castShadow>
            <boxGeometry args={[houseWidth * 0.8, 0.04, 0.38]} />
            <WorldMaterial tone="roof" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={`post-${side}`}
              position={[side * (houseWidth * 0.36), -houseHeight * 0.22, 0.16]}
            >
              <cylinderGeometry args={[0.025, 0.025, houseHeight * 0.48, 6]} />
              <WorldMaterial tone="metal" />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. ACCESSORY: Tall Overhead GP Water Tank Tower */}
      {hasWaterTank && (
        <group position={[plotWidth * 0.34, 0.16, -plotDepth * 0.34]}>
          {/* 4 Steel Stanchion Legs */}
          {[-0.1, 0.1].map((x) =>
            [-0.1, 0.1].map((z) => (
              <mesh key={`tank-leg-${x}-${z}`} position={[x, 0.65, z]}>
                <cylinderGeometry args={[0.02, 0.02, 1.3, 4]} />
                <WorldMaterial tone="slate" />
              </mesh>
            )),
          )}
          {/* Tower Platform */}
          <mesh position={[0, 1.3, 0]} castShadow>
            <boxGeometry args={[0.3, 0.04, 0.3]} />
            <WorldMaterial tone="metal" />
          </mesh>
          {/* Black GeePee Water Tank */}
          <mesh position={[0, 1.62, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.6, 16]} />
            <meshStandardMaterial color="#0b0f19" roughness={0.3} metalness={0.1} />
          </mesh>
          {/* Tank Lid */}
          <mesh position={[0, 1.94, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.04, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* 7. ACCESSORY: Soundproof Generator Shed with Exhaust */}
      {hasGenerator && (
        <group position={[-plotWidth * 0.33, 0.16, -plotDepth * 0.28]}>
          {/* Generator Box */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.32, 0.36, 0.26]} />
            <meshStandardMaterial color="#15803d" roughness={0.4} metalness={0.3} />
          </mesh>
          {/* Exhaust Silencer Muffler */}
          <mesh position={[0.08, 0.44, -0.05]}>
            <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
            <WorldMaterial tone="metal" />
          </mesh>
        </group>
      )}

      {/* 8. ACCESSORY: Rooftop Solar Inverter Array (Tier 3) */}
      {hasSolar && (
        <group position={[0, houseHeight + 0.38, -plotDepth * 0.05]}>
          <mesh rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[houseWidth * 0.68, 0.03, houseDepth * 0.52]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.1} metalness={0.9} />
          </mesh>
        </group>
      )}

      {/* 9. Status Beacon Above Entrance */}
      <group position={[0, houseHeight * 0.62 + 0.16, -plotDepth * 0.05 + houseDepth / 2 + 0.06]}>
        <mesh ref={statusLightRef}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      </group>
    </group>
  );
};
