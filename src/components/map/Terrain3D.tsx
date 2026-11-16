import { useMemo } from "react";
import { WorldInstances, WorldMaterial } from "@/components/3d/WorldScene";
import { townSurfaceLayout, TOWN_SURFACE } from "./town-surface-layout";

export interface Terrain3DProps {
  rows: readonly string[];
  cellSize: number;
}

/** Solid land tiles leave real openings for the authored river; roads sit above y=0. */
export function Terrain3D({ rows, cellSize }: Terrain3DProps) {
  const terrain = useMemo(() => townSurfaceLayout(rows, cellSize), [rows, cellSize]);
  return (
    <group>
      <mesh position={[0, TOWN_SURFACE.bedTop - 0.24, 0]} receiveShadow>
        <boxGeometry args={[terrain.width, 0.48, terrain.depth]} />
        <WorldMaterial tone="clay" />
      </mesh>
      <WorldInstances items={terrain.land} tone="cityLawn" castShadow={false} />
      <WorldInstances items={terrain.water} tone="cityWater" castShadow={false} />
      <WorldInstances items={terrain.banks} tone="concrete" />
    </group>
  );
}
