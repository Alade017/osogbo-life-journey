import { type FC } from "react";
import { WorldInstances } from "@/components/3d/WorldScene";

export interface FunctionalStreetLights3DProps {
  positions: readonly [number, number][];
  size: number;
  isNight?: boolean;
}

/**
 * Functional 3D Streetlight System with Automatic Day/Night Sensor.
 * At night, lamps emit brilliant warm sodium-vapor glow with projected light pools
 * on road surfaces and strategic junction illumination.
 */
export const FunctionalStreetLights3D: FC<FunctionalStreetLights3DProps> = ({
  positions,
  size,
  isNight = false,
}) => {
  const poleHeight = size * 1.45;

  return (
    <group>
      {/* 1. Metal Vertical Lamp Poles */}
      <WorldInstances
        tone="metal"
        items={positions.map(([x, z]) => ({
          position: [x, poleHeight / 2, z],
          scale: [size * 0.04, poleHeight, size * 0.04],
        }))}
      />

      {/* 2. Horizontal Extension Arms */}
      <WorldInstances
        tone="metal"
        items={positions.map(([x, z]) => ({
          position: [x + size * 0.22, poleHeight * 0.92, z],
          scale: [size * 0.44, size * 0.04, size * 0.04],
        }))}
      />

      {/* 3. Lamp Head Fixtures (Daytime = linen, Nighttime = glowing warm yellow) */}
      <WorldInstances
        tone={isNight ? "accent" : "linen"}
        shape="sphere"
        items={positions.map(([x, z]) => ({
          position: [x + size * 0.4, poleHeight * 0.88, z],
          scale: [size * 0.14, size * 0.1, size * 0.14],
        }))}
      />

      {/* 4. Nighttime Road Illumination Pools */}
      {isNight && (
        <group position={[0, 0.04, 0]}>
          {positions.map(([x, z], idx) => (
            <group key={`light-pool-${idx}`} position={[x + size * 0.4, 0, z]}>
              {/* Soft Ground Light Pool on Asphalt */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[size * 0.85, 18]} />
                <meshBasicMaterial color="#fef08a" transparent opacity={0.32} />
              </mesh>

              {/* Central Concentrated Glow */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[size * 0.38, 14]} />
                <meshBasicMaterial color="#fde047" transparent opacity={0.5} />
              </mesh>

              {/* Point light for every 3rd lamp at key junctions */}
              {idx % 3 === 0 && (
                <pointLight
                  position={[0, poleHeight * 0.85, 0]}
                  color="#fef08a"
                  intensity={2.8}
                  distance={size * 4}
                  decay={2}
                />
              )}
            </group>
          ))}
        </group>
      )}
    </group>
  );
};
