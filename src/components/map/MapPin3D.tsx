import { useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type { Group } from "three";
import { placeBadgeFor } from "./map-badge";

export interface MapPin3DProps {
  position: [number, number, number];
  label: string;
  category: string;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

/**
 * Animated 3D Landmark Pin floating above points of interest on the map.
 * Replaces static HTML badges with a hardware-accelerated 3D marker
 * featuring idle bobbing, smooth hover elevation, and selection pulses.
 */
export const MapPin3D: FC<MapPin3DProps> = ({
  position,
  label,
  category,
  isSelected = false,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const pinGroupRef = useRef<Group>(null);
  const badgeInfo = placeBadgeFor(category);

  // Subtle hash-based phase offset so landmarks don't all bob in lockstep
  const phaseOffset = (position[0] * 3.7 + position[2] * 2.3) % (Math.PI * 2);

  useFrame(({ clock }) => {
    if (!pinGroupRef.current) return;
    const t = clock.getElapsedTime();

    // Idle sine-wave floating animation
    const floatSpeed = isSelected ? 3.0 : 2.0;
    const floatAmplitude = isSelected ? 0.16 : 0.09;
    const bob = Math.sin(t * floatSpeed + phaseOffset) * floatAmplitude;
    pinGroupRef.current.position.y = position[1] + bob;

    // Hover / selection scale feedback
    const baseScale = isSelected ? 1.18 : isHovered ? 1.12 : 1.0;
    const pulse = isSelected ? Math.sin(t * 5.0) * 0.04 : 0;
    const targetScale = baseScale + pulse;
    pinGroupRef.current.scale.lerp(
      { x: targetScale, y: targetScale, z: targetScale } as any,
      0.18,
    );
  });

  return (
    <group
      ref={pinGroupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver?.();
      }}
      onPointerOut={() => onPointerOut?.()}
    >
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Pin Stem / Pointer Tip */}
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.04, 0.01, 0.42, 8]} />
          <meshStandardMaterial color={badgeInfo.tone} roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Pin Head Sphere */}
        <mesh position={[0, 0.54, 0]} castShadow>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color={badgeInfo.tone} roughness={0.25} />
        </mesh>

        {/* Inner Badge Disc */}
        <mesh position={[0, 0.54, 0.12]}>
          <circleGeometry args={[0.18, 16]} />
          <meshBasicMaterial color="#0b0f17" />
        </mesh>

        {/* Category Emoji Glyph */}
        <Text
          position={[0, 0.54, 0.14]}
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
        >
          {badgeInfo.emoji}
        </Text>

        {/* Floating Label Text */}
        <Text
          position={[0, 0.94, 0]}
          fontSize={0.24}
          color="#f8fafc"
          outlineWidth={0.035}
          outlineColor="#0b0f17"
          anchorX="center"
          anchorY="bottom"
          fontWeight="bold"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
};
