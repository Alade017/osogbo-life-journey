import { useMemo, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { Color } from "three";
import { WorldMaterial } from "@/components/3d/WorldScene";
import { WORLD_PALETTE } from "@/components/3d/world-theme";

/** Terrain tones are darkened so the white backdrop frames the town. */
const TERRAIN_DIM = 0.72;
const dimmed = (hex: string) => new Color(hex).multiplyScalar(TERRAIN_DIM).getStyle();

export interface Terrain3DProps {
  gridCols: number;
  gridRows: number;
  cellSize: number;
}

/**
 * 3D Stepped Relief Terrain for the Osogbo map diorama.
 * Solves the flat appearance by introducing tiered elevation plateaus,
 * a sunken reflective river channel, and stone terrace retaining walls.
 */
export const Terrain3D: FC<Terrain3DProps> = ({ gridCols, cellSize }) => {
  const waterMeshRef = useRef<Mesh>(null);

  const totalWidth = gridCols * cellSize;
  const totalDepth = 18 * cellSize;

  // Gentle river water shimmer
  useFrame(({ clock }) => {
    if (!waterMeshRef.current) return;
    const t = clock.getElapsedTime();
    waterMeshRef.current.position.y = -0.18 + Math.sin(t * 1.5) * 0.02;
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Base Ground Foundation Plinth (Diorama base) */}
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 1.6, 0.8, totalDepth + 1.6]} />
        <WorldMaterial color={dimmed(WORLD_PALETTE.concrete)} />
      </mesh>

      {/* Earth & Grass Top Layer */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 0.8, 0.3, totalDepth + 0.8]} />
        <WorldMaterial color={dimmed(WORLD_PALETTE.ground)} />
      </mesh>

      {/* 2. Elevated Civic & Palace Plateau Terrace (High-elevation district) */}
      <group position={[-totalWidth * 0.14, 0.18, -totalDepth * 0.18]}>
        {/* Retaining Wall */}
        <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
          <boxGeometry args={[totalWidth * 0.38, 0.36, totalDepth * 0.36]} />
          <WorldMaterial color={dimmed(WORLD_PALETTE.wall)} />
        </mesh>
        {/* Upper Grass Lawn */}
        <mesh position={[0, 0.34, 0]} receiveShadow>
          <boxGeometry args={[totalWidth * 0.36, 0.04, totalDepth * 0.34]} />
          <WorldMaterial color={dimmed(WORLD_PALETTE.foliage)} />
        </mesh>
        {/* Stone steps / Ramp outline */}
        <mesh position={[0, 0.1, totalDepth * 0.185]}>
          <boxGeometry args={[cellSize * 1.8, 0.2, 0.4]} />
          <WorldMaterial color={dimmed(WORLD_PALETTE.concrete)} />
        </mesh>
      </group>

      {/* 3. Market Quarter Commercial Terrace (Medium elevation) */}
      <group position={[-totalWidth * 0.28, 0.08, totalDepth * 0.16]}>
        <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
          <boxGeometry args={[totalWidth * 0.34, 0.2, totalDepth * 0.32]} />
          <WorldMaterial color={dimmed(WORLD_PALETTE.concrete)} />
        </mesh>
      </group>

      {/* 4. Sunken River Osun Channel (Carved water channel with stone banks) */}
      <group position={[totalWidth * 0.32, -0.15, 0]}>
        {/* Channel Bed Excavation */}
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <boxGeometry args={[cellSize * 2.8, 0.3, totalDepth * 0.94]} />
          <WorldMaterial tone="slate" />
        </mesh>

        {/* Dynamic Water Surface */}
        <mesh ref={waterMeshRef} position={[0, -0.08, 0]}>
          <boxGeometry args={[cellSize * 2.6, 0.06, totalDepth * 0.92]} />
          <meshStandardMaterial
            color="#0284c7"
            roughness={0.12}
            metalness={0.7}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* River Embankment Stone Curbs */}
        {[-1, 1].map((side) => (
          <mesh
            key={`river-bank-${side}`}
            position={[side * (cellSize * 1.35), 0.06, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.22, 0.24, totalDepth * 0.94]} />
            <WorldMaterial color={dimmed(WORLD_PALETTE.concrete)} />
          </mesh>
        ))}

        {/* Stone Arch Bridge Crossing */}
        <group position={[0, 0.14, -totalDepth * 0.1]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[cellSize * 3.1, 0.16, cellSize * 1.2]} />
            <WorldMaterial color={dimmed(WORLD_PALETTE.concrete)} />
          </mesh>
          {/* Bridge Railings */}
          {[-1, 1].map((side) => (
            <mesh
              key={`bridge-rail-${side}`}
              position={[0, 0.22, side * (cellSize * 0.55)]}
              castShadow
            >
              <boxGeometry args={[cellSize * 3.1, 0.24, 0.08]} />
              <WorldMaterial tone="metal" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};
