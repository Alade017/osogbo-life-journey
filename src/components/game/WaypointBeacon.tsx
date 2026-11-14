import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { WORLD_PALETTE, WORLD_SCALE } from "@/components/3d/world-theme";

/** A light beam and a bobbing pin above the tapped destination. Pure decoration. */
export function WaypointBeacon({ position }: { position: readonly [number, number, number] }) {
  const pin = useRef<Group>(null);
  const height = WORLD_SCALE.character * 2.2;
  useFrame(({ clock }) => {
    if (pin.current) pin.current.position.y = height + Math.sin(clock.elapsedTime * 3) * 0.06;
  });
  return (
    <group position={[position[0], 0, position[2]]} raycast={() => null}>
      <mesh position={[0, height / 2, 0]} raycast={() => null}>
        <cylinderGeometry
          args={[WORLD_SCALE.character * 0.05, WORLD_SCALE.character * 0.05, height, 10, 1, true]}
        />
        <meshBasicMaterial
          color={WORLD_PALETTE.sign}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <group ref={pin} position={[0, height, 0]}>
        <mesh raycast={() => null}>
          <sphereGeometry args={[WORLD_SCALE.character * 0.09, 12, 10]} />
          <meshStandardMaterial
            color={WORLD_PALETTE.sign}
            emissive={WORLD_PALETTE.sign}
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh
          position={[0, -WORLD_SCALE.character * 0.12, 0]}
          rotation={[Math.PI, 0, 0]}
          raycast={() => null}
        >
          <coneGeometry args={[WORLD_SCALE.character * 0.07, WORLD_SCALE.character * 0.14, 10]} />
          <meshStandardMaterial color={WORLD_PALETTE.sign} />
        </mesh>
      </group>
    </group>
  );
}
