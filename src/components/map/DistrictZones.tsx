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
    const tint = DISTRICT_TINTS[district.theme] ?? DISTRICT_FALLBACK;
    const thickness = Math.max(0.035, cell * 0.018);
    const dashLength = cell * 0.62;
    const dashScale: [number, number, number] = [dashLength, 0.025, thickness];
    const sideScale: [number, number, number] = [thickness, 0.025, dashLength];
    const items: WorldInstance[] = [];

    // Short, evenly spaced boundary marks keep district edges legible without
    // drawing a heavy continuous frame across streets and building footprints.
    for (let x = 0; x < area.width; x += 1) {
      const sampleX = area.x + x + 0.5;
      const [topX, , topZ] = point(sampleX, area.z);
      const [bottomX, , bottomZ] = point(sampleX, area.z + area.depth);
      items.push(
        { position: [topX, 0.045, topZ], scale: dashScale, color: tint },
        { position: [bottomX, 0.045, bottomZ], scale: dashScale, color: tint },
      );
    }

    for (let z = 0; z < area.depth; z += 1) {
      const sampleZ = area.z + z + 0.5;
      const [leftX, , leftZ] = point(area.x, sampleZ);
      const [rightX, , rightZ] = point(area.x + area.width, sampleZ);
      items.push(
        { position: [leftX, 0.045, leftZ], scale: sideScale, color: tint },
        { position: [rightX, 0.045, rightZ], scale: sideScale, color: tint },
      );
    }

    return items;
  });

  return (
    <>
      <WorldInstances items={boundarySegments} tone="linen" />
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
