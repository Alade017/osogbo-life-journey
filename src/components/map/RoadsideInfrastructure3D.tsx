import { WorldMaterial } from "@/components/3d/WorldScene";

export type UtilityPolePosition = [number, number];
export type UtilityWireSpan = {
  start: UtilityPolePosition;
  end: UtilityPolePosition;
};
export type RoadDrainSegment = {
  position: [number, number, number];
  horizontal: boolean;
  length: number;
};

/**
 * Lightweight street infrastructure for the town overview: concrete power
 * poles, crossarms, insulators, overhead conductors and roadside drains.
 */
export function RoadsideInfrastructure3D({
  poles,
  spans,
  drains,
  cellSize,
}: {
  poles: UtilityPolePosition[];
  spans: UtilityWireSpan[];
  drains: RoadDrainSegment[];
  cellSize: number;
}) {
  return (
    <group>
      {poles.map(([x, z], index) => (
        <group key={`utility-pole-${index}`} position={[x, 0, z]}>
          <mesh position={[0, 1.65, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.11, 3.3, 7]} />
            <WorldMaterial tone="concrete" />
          </mesh>
          <mesh position={[0, 3.18, 0]} castShadow>
            <boxGeometry args={[0.9, 0.09, 0.12]} />
            <WorldMaterial tone="timber" />
          </mesh>
          {[-0.32, 0, 0.32].map((offset) => (
            <group key={offset} position={[offset, 3.27, 0]}>
              <mesh>
                <cylinderGeometry args={[0.045, 0.045, 0.13, 6]} />
                <WorldMaterial tone="slate" />
              </mesh>
              <mesh position={[0, 0.11, 0]}>
                <sphereGeometry args={[0.035, 6, 5]} />
                <WorldMaterial tone="linen" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 2.95, 0.01]}>
            <boxGeometry args={[0.18, 0.16, 0.16]} />
            <WorldMaterial tone="metal" />
          </mesh>
        </group>
      ))}
      {spans.map(({ start, end }, index) => {
        const dx = end[0] - start[0];
        const dz = end[1] - start[1];
        const length = Math.hypot(dx, dz);
        if (length < 0.1 || length > cellSize * 6) return null;
        const angle = Math.atan2(dz, dx);
        return [-0.22, 0.22].map((offset) => (
          <mesh
            key={`power-span-${index}-${offset}`}
            position={[(start[0] + end[0]) / 2, 3.48, (start[1] + end[1]) / 2 + offset]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[length, 0.018, 0.018]} />
            <meshStandardMaterial color="#242b31" roughness={0.8} />
          </mesh>
        ));
      })}
      {drains.map((drain, index) => (
        <group key={`road-drain-${index}`} position={drain.position}>
          <mesh position={[0, 0.025, 0]} receiveShadow>
            <boxGeometry
              args={
                drain.horizontal
                  ? [drain.length, 0.055, cellSize * 0.11]
                  : [cellSize * 0.11, 0.055, drain.length]
              }
            />
            <WorldMaterial tone="concrete" />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry
              args={
                drain.horizontal
                  ? [drain.length * 0.92, 0.012, cellSize * 0.055]
                  : [cellSize * 0.055, 0.012, drain.length * 0.92]
              }
            />
            <meshStandardMaterial color="#263238" roughness={1} />
          </mesh>
          {Array.from({ length: Math.max(1, Math.floor(drain.length / cellSize)) }, (_, cover) => (
            <mesh
              key={cover}
              position={
                drain.horizontal
                  ? [(cover + 0.5) * cellSize - drain.length / 2, 0.07, 0]
                  : [0, 0.07, (cover + 0.5) * cellSize - drain.length / 2]
              }
            >
              <boxGeometry
                args={
                  drain.horizontal
                    ? [cellSize * 0.08, 0.025, cellSize * 0.13]
                    : [cellSize * 0.13, 0.025, cellSize * 0.08]
                }
              />
              <WorldMaterial tone="wall" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
