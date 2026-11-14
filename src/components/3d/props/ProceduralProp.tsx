import { useMemo } from "react";
import { WorldMaterial } from "../WorldScene";
import type { PropPart } from "./procedural-props";

/** Draws a prop built by a procedural builder: one mesh per merged tone, placed in the scene. */
export function ProceduralProp({
  parts,
  position,
  rotation = 0,
}: {
  parts: readonly PropPart[];
  position: [number, number, number];
  rotation?: number;
}) {
  const meshes = useMemo(() => parts, [parts]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {meshes.map((item, index) => (
        <mesh key={index} geometry={item.geometry} castShadow receiveShadow>
          <WorldMaterial tone={item.tone} />
        </mesh>
      ))}
    </group>
  );
}
