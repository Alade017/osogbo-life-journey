import type { FC } from "react";
import { WorldMaterial } from "@/components/3d/WorldScene";

export interface Terrain3DProps {
  gridCols: number;
  gridRows: number;
  cellSize: number;
  waterCells: readonly (readonly number[])[];
}

/**
 * Data-driven town terrain. The ground follows the supplied grid dimensions
 * and water is rendered only in cells marked as water by the town layout.
 */
export const Terrain3D: FC<Terrain3DProps> = ({
  gridCols,
  gridRows,
  cellSize,
  waterCells,
}) => {
  const totalWidth = gridCols * cellSize;
  const totalDepth = gridRows * cellSize;

  return (
    <group>
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 1.6, 0.8, totalDepth + 1.6]} />
        <WorldMaterial tone="concrete" />
      </mesh>

      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 0.8, 0.3, totalDepth + 0.8]} />
        <WorldMaterial tone="ground" />
      </mesh>

      {waterCells.map(([x, z], index) => (
        <mesh
          key={`terrain-water-${x}-${z}-${index}`}
          position={[
            (x - (gridCols - 1) / 2) * cellSize,
            0.115,
            (z - (gridRows - 1) / 2) * cellSize,
          ]}
          receiveShadow
        >
          <boxGeometry args={[cellSize * 0.94, 0.035, cellSize * 0.94]} />
          <meshStandardMaterial
            color="#0284c7"
            roughness={0.18}
            metalness={0.45}
            transparent
            opacity={0.88}
          />
        </mesh>
      ))}
    </group>
  );
};
