import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { WorldMaterial } from "../3d/WorldScene";
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
  return (
    <>
      {districts.map((district) => {
        const a = district.gridArea;
        const [cx, , cz] = point(a.x + a.width / 2 - 0.5, a.z + a.depth / 2 - 0.5);
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
