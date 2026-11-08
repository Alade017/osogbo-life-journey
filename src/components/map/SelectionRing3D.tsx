import { useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export interface SelectionRing3DProps {
  position: [number, number, number];
  color?: string;
  radius?: number;
}

/**
 * Animated Ground Selection Beacon.
 * Displays an expanding radial pulse ring beneath a selected landmark or property.
 */
export const SelectionRing3D: FC<SelectionRing3DProps> = ({
  position,
  color = "#38bdf8",
  radius = 1.0,
}) => {
  const innerRingRef = useRef<Mesh>(null);
  const outerRingRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Pulse wave 1
    const p1 = (t * 1.4) % 1.0;
    if (innerRingRef.current) {
      const s1 = 0.5 + p1 * 0.7;
      innerRingRef.current.scale.set(s1, s1, 1);
      const mat = innerRingRef.current.material as import("three").MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, (1 - p1) * 0.85);
    }

    // Pulse wave 2 (offset)
    const p2 = (t * 1.4 + 0.5) % 1.0;
    if (outerRingRef.current) {
      const s2 = 0.5 + p2 * 0.7;
      outerRingRef.current.scale.set(s2, s2, 1);
      const mat = outerRingRef.current.material as import("three").MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, (1 - p2) * 0.6);
    }
  });

  return (
    <group position={[position[0], 0.04, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Central Target Disc */}
      <mesh>
        <circleGeometry args={[radius * 0.28, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Pulse Ring 1 */}
      <mesh ref={innerRingRef}>
        <ringGeometry args={[radius * 0.45, radius * 0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Pulse Ring 2 */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[radius * 0.45, radius * 0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};
