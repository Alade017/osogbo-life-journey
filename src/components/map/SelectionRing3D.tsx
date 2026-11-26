import { TOWN_SURFACE } from "./town-surface-layout";
export interface SelectionRing3DProps {
  position: [number, number, number];
  color?: string;
  radius?: number;
}

export function SelectionRing3D({
  position,
  color = "#38bdf8",
  radius = 1.0,
}: SelectionRing3DProps) {
  return (
    <group
      position={[position[0], TOWN_SURFACE.groundTop + 0.04, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh renderOrder={2}>
        <ringGeometry args={[radius * 0.9, radius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* Central Target Disc */}
      <mesh>
        <circleGeometry args={[radius * 0.28, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
