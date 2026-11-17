import { WORLD_PALETTE } from "./world-theme";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
/** Local navigation visitor; does not replace the saved multiplayer character. */
export function VenueVisitor({
  position,
  facing,
  walking = false,
  uniformColor = WORLD_PALETTE.indigo,
}: {
  position: readonly [number, number, number];
  facing: string;
  walking?: boolean;
  uniformColor?: string;
}) {
  const legs = useRef<(Group | null)[]>([]),
    arms = useRef<(Group | null)[]>([]);
  const headings: Record<string, number> = { north: Math.PI, south: 0, east: Math.PI / 2, west: -Math.PI / 2 };
  const yaw = headings[facing] ?? 0;
  useFrame(({ clock }) => {
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const swing = walking && !reduced ? Math.sin(clock.elapsedTime * 10) * 0.4 : 0;
    for (let i = 0; i < 2; i++) {
      const angle = swing * (i === 0 ? 1 : -1);
      if (legs.current[i]) legs.current[i]!.rotation.x = angle;
      if (arms.current[i]) arms.current[i]!.rotation.x = -angle;
    }
  });
  return (
    <group position={[...position]} rotation={[0, yaw, 0]} name="venue-walkthrough-visitor">
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.45, 0.65, 0.25]} />
        <meshStandardMaterial color={uniformColor} />
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <sphereGeometry args={[0.2, 12, 8]} />
        <meshStandardMaterial color="#9b7156" />
      </mesh>
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <group
            ref={(node) => {
              legs.current[i] = node;
            }}
            position={[side * 0.13, 0.75, 0]}
          >
            <mesh position={[0, -0.35, 0]} castShadow>
              <boxGeometry args={[0.17, 0.7, 0.2]} />
              <meshStandardMaterial color="#45525b" />
            </mesh>
          </group>
          <group
            ref={(node) => {
              arms.current[i] = node;
            }}
            position={[side * 0.3, 1.32, 0]}
          >
            <mesh position={[0, -0.3, 0]} castShadow>
              <boxGeometry args={[0.13, 0.6, 0.16]} />
              <meshStandardMaterial color="#9b7156" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
