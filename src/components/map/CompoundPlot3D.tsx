import { useRef, type FC } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import type { MapProperty } from "./MapCanvas";

export interface CompoundPlot3DProps {
  property: MapProperty;
  cellSize?: number;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
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
 * Assembles authentic Nigerian residential compound architecture
 * (main house, overhead GP water tank, generator enclosure, compound perimeter wall,
 * gate, and veranda awning) purely data-driven from the property tier, type, and status.
 */
export const CompoundPlot3D: FC<CompoundPlot3DProps> = ({
  property,
  cellSize = 2,
  isSelected = false,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const rootGroupRef = useRef<Group>(null);
  const statusLightRef = useRef<Mesh>(null);

  const { type, tier, status, position, rotation = 0 } = property;

  // Proportional sizing derived strictly from cellSize and property tier
  const plotWidth = cellSize * 0.88;
  const plotDepth = cellSize * 0.88;
  const isMultiStory = tier === 3 || (tier === 2 && type === "flat");
  const houseWidth = plotWidth * (type === "compound" ? 0.62 : type === "shophouse" ? 0.55 : 0.5);
  const houseDepth = plotDepth * (type === "compound" ? 0.5 : type === "shophouse" ? 0.58 : 0.46);
  const houseHeight = cellSize * (isMultiStory ? 0.68 : 0.45);

  const statusColor = STATUS_INDICATOR_COLORS[status] ?? STATUS_INDICATOR_COLORS.vacant;
  const hasWaterTank = tier >= 2 || type === "compound";
  const hasGenerator = tier >= 2 || status === "current" || status === "owned";
  const hasSolar = tier === 3;
  const hasVeranda = type === "compound" || type === "shophouse" || tier >= 2;

  // Gentle idle animation: subtle scale hover and status beacon pulse
  useFrame(({ clock }) => {
    if (!rootGroupRef.current) return;
    const t = clock.getElapsedTime();

    // Hover scale bounce
    const targetScale = isSelected ? 1.05 : isHovered ? 1.03 : 1.0;
    rootGroupRef.current.scale.lerp({ x: targetScale, y: targetScale, z: targetScale } as any, 0.15);

    // Subtle beacon glow pulse
    if (statusLightRef.current) {
      const pulse = 0.85 + Math.sin(t * 3.5) * 0.15;
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
      {/* 1. Compound Yard Ground Slab */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[plotWidth, 0.08, plotDepth]} />
        <WorldMaterial tone="concrete" />
      </mesh>

      {/* 2. Compound Perimeter Wall with Front Entrance Gap */}
      <group position={[0, 0.22, 0]}>
        {/* Rear Wall */}
        <mesh position={[0, 0, -plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth, 0.32, 0.08]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Left Wall */}
        <mesh position={[-plotWidth * 0.48, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.32, plotDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Right Wall */}
        <mesh position={[plotWidth * 0.48, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.32, plotDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Front Left Wall Segment */}
        <mesh position={[-plotWidth * 0.3, 0, plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth * 0.36, 0.32, 0.08]} />
          <WorldMaterial tone="wall" />
        </mesh>
        {/* Front Right Wall Segment */}
        <mesh position={[plotWidth * 0.3, 0, plotDepth * 0.48]} castShadow>
          <boxGeometry args={[plotWidth * 0.36, 0.32, 0.08]} />
          <WorldMaterial tone="wall" />
        </mesh>
      </group>

      {/* 3. Compound Gate Pillars & Black Iron Gate */}
      <group position={[0, 0.25, plotDepth * 0.48]}>
        {/* Gate Pillars */}
        <mesh position={[-plotWidth * 0.12, 0.05, 0]} castShadow>
          <boxGeometry args={[0.1, 0.44, 0.1]} />
          <WorldMaterial tone="concrete" />
        </mesh>
        <mesh position={[plotWidth * 0.12, 0.05, 0]} castShadow>
          <boxGeometry args={[0.1, 0.44, 0.1]} />
          <WorldMaterial tone="concrete" />
        </mesh>
        {/* Iron Swing Gate */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[plotWidth * 0.2, 0.34, 0.03]} />
          <WorldMaterial tone="slate" />
        </mesh>
      </group>

      {/* 4. Main House Structure */}
      <group position={[0, houseHeight / 2 + 0.08, -plotDepth * 0.06]}>
        {/* Main Block Walls */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[houseWidth, houseHeight, houseDepth]} />
          <WorldMaterial tone="wall" />
        </mesh>

        {/* Corrugated Roof Pitch */}
        <mesh
          position={[0, houseHeight / 2 + 0.14, 0]}
          rotation={[0, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[houseWidth + 0.14, 0.16, houseDepth + 0.14]} />
          <WorldMaterial tone={tier === 3 ? "accent" : status === "current" ? "roof" : "clay"} />
        </mesh>

        {/* Front Entrance Door */}
        <mesh position={[0, -houseHeight / 2 + 0.22, houseDepth / 2 + 0.02]}>
          <boxGeometry args={[houseWidth * 0.26, 0.42, 0.04]} />
          <WorldMaterial tone="timber" />
        </mesh>

        {/* Windows */}
        {[-1, 1].map((side) => (
          <group
            key={`win-${side}`}
            position={[side * (houseWidth * 0.32), 0.02, houseDepth / 2 + 0.02]}
          >
            <mesh>
              <boxGeometry args={[houseWidth * 0.2, houseHeight * 0.28, 0.03]} />
              <WorldMaterial tone="windowFrame" />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[houseWidth * 0.16, houseHeight * 0.24, 0.015]} />
              <WorldMaterial tone="glass" />
            </mesh>
          </group>
        ))}

        {/* Upper Windows for Multi-story Buildings */}
        {isMultiStory &&
          [-1, 1].map((side) => (
            <mesh
              key={`upper-win-${side}`}
              position={[side * (houseWidth * 0.28), houseHeight * 0.26, houseDepth / 2 + 0.02]}
            >
              <boxGeometry args={[houseWidth * 0.18, houseHeight * 0.22, 0.02]} />
              <WorldMaterial tone="windowFrame" />
            </mesh>
          ))}
      </group>

      {/* 5. Veranda Awning / Front Sunshade */}
      {hasVeranda && (
        <group position={[0, houseHeight * 0.42 + 0.08, -plotDepth * 0.06 + houseDepth / 2 + 0.14]}>
          <mesh rotation={[-0.18, 0, 0]} castShadow>
            <boxGeometry args={[houseWidth * 0.72, 0.03, 0.28]} />
            <WorldMaterial tone="roof" />
          </mesh>
          {/* Slender Veranda Posts */}
          {[-1, 1].map((side) => (
            <mesh
              key={`post-${side}`}
              position={[side * (houseWidth * 0.33), -houseHeight * 0.2, 0.12]}
            >
              <cylinderGeometry args={[0.02, 0.02, houseHeight * 0.42, 6]} />
              <WorldMaterial tone="metal" />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. ACCESSORY: Overhead GP Water Tank Tower */}
      {hasWaterTank && (
        <group position={[plotWidth * 0.34, 0.08, -plotDepth * 0.34]}>
          {/* 4 Steel Stanchion Legs */}
          {[-0.07, 0.07].map((x) =>
            [-0.07, 0.07].map((z) => (
              <mesh key={`tank-leg-${x}-${z}`} position={[x, 0.42, z]}>
                <cylinderGeometry args={[0.015, 0.015, 0.82, 4]} />
                <WorldMaterial tone="slate" />
              </mesh>
            )),
          )}
          {/* Tower Platform */}
          <mesh position={[0, 0.83, 0]} castShadow>
            <boxGeometry args={[0.22, 0.03, 0.22]} />
            <WorldMaterial tone="metal" />
          </mesh>
          {/* Black GeePee Water Tank */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.4, 14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.35} />
          </mesh>
          {/* Tank Lid */}
          <mesh position={[0, 1.26, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* 7. ACCESSORY: Generator Shed */}
      {hasGenerator && (
        <group position={[-plotWidth * 0.33, 0.08, -plotDepth * 0.28]}>
          {/* Generator Enclosure Box */}
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.22, 0.24, 0.18]} />
            <meshStandardMaterial color="#166534" roughness={0.4} metalness={0.4} />
          </mesh>
          {/* Exhaust Silencer Stack */}
          <mesh position={[0.06, 0.28, -0.04]}>
            <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
            <WorldMaterial tone="metal" />
          </mesh>
        </group>
      )}

      {/* 8. ACCESSORY: Rooftop Solar Array (Tier 3) */}
      {hasSolar && (
        <group position={[0, houseHeight + 0.24, -plotDepth * 0.06]}>
          <mesh rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[houseWidth * 0.58, 0.02, houseDepth * 0.42]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.1} metalness={0.85} />
          </mesh>
        </group>
      )}

      {/* 9. Status Indicator Light Beacon (Above entrance) */}
      <group position={[0, houseHeight * 0.58 + 0.08, -plotDepth * 0.06 + houseDepth / 2 + 0.05]}>
        <mesh ref={statusLightRef}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      </group>
    </group>
  );
};
