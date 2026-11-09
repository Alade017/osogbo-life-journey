import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { WorldInstances, WorldMaterial, type WorldInstance } from "../3d/WorldScene";
import { DISTRICT_FALLBACK, DISTRICT_TINTS } from "./district-tints";

type District = {
  id: string;
  name: string;
  theme: string;
  traffic: string;
  gridArea: { x: number; z: number; width: number; depth: number };
};

export function DistrictZones({
  districts,
  point,
  cell,
  onSelect,
}: {
  districts: readonly District[];
  point: (x: number, z: number) => [number, number, number];
  cell: number;
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const boundarySegments: WorldInstance[] = districts.flatMap((district): WorldInstance[] => {
    const area = district.gridArea;
    const [centerX, , centerZ] = point(
      area.x + area.width / 2,
      area.z + area.depth / 2,
    );
    const halfWidth = (area.width * cell) / 2;
    const halfDepth = (area.depth * cell) / 2;
    const y = 0.026;
    const thickness = Math.max(0.035, cell * 0.018);

    return [
      { position: [centerX, y, centerZ - halfDepth], scale: [halfWidth * 2, 0.018, thickness] },
      { position: [centerX, y, centerZ + halfDepth], scale: [halfWidth * 2, 0.018, thickness] },
      { position: [centerX - halfWidth, y, centerZ], scale: [thickness, 0.018, halfDepth * 2] },
      { position: [centerX + halfWidth, y, centerZ], scale: [thickness, 0.018, halfDepth * 2] },
    ];
  });

  return (
    <>
      <WorldInstances items={boundarySegments} tone="timber" />
      {districts.map((district) => {
        const a = district.gridArea;
        const [cx, , cz] = point(a.x + a.width / 2, a.z + a.depth / 2);
        const tint = DISTRICT_TINTS[district.theme] ?? DISTRICT_FALLBACK;
        return (
          <group key={district.id}>
            <mesh
              position={[cx, 0.006, cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => onSelect(district.id, event)}
            >
              <planeGeometry args={[a.width * cell * 0.96, a.depth * cell * 0.96]} />
              <WorldMaterial tone="ground" color={tint} />
            </mesh>
            <Html position={[cx, 0.2, cz]} center zIndexRange={[10, 0]} pointerEvents="none">
              <span className="district-label" data-traffic={district.traffic}>
                {district.name}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}
