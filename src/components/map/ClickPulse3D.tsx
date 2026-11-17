import { useEffect, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import { TOWN_SURFACE } from "./town-surface-layout";

const PULSE_SECONDS = 0.5;

/** A short ring that expands and fades under a place the player just clicked. */
export const ClickPulse3D: FC<{
  position: [number, number, number];
  color?: string;
  radius?: number;
  onDone: () => void;
}> = ({ position, color = "#f2b21c", radius = 1, onDone }) => {
  const ringRef = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const timer = window.setTimeout(() => doneRef.current(), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const progress = Math.min(1, elapsed.current / PULSE_SECONDS);
    const ring = ringRef.current;
    if (ring) {
      const scale = 0.6 + progress * 1.1;
      ring.scale.set(scale, scale, 1);
      const material = ring.material as MeshBasicMaterial;
      material.opacity = (1 - progress) * 0.9;
    }
    if (progress >= 1) doneRef.current();
  });

  return (
    <group
      position={[position[0], TOWN_SURFACE.groundTop + 0.06, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={ringRef} renderOrder={3}>
        <ringGeometry args={[radius * 0.85, radius, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
};
