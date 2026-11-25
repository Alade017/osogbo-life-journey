import districtDirectory from "@/data/osogbo-map.json";
import type { ThreeEvent } from "@react-three/fiber";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";

const districtNames = new Map(districtDirectory.districts.map((d) => [d.id, d.name]));

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
  showLabels = true,
}: {
  districts: readonly District[];
  showLabels?: boolean;
  point: (x: number, z: number) => [number, number, number];
  cell: number;
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <>
      {districts.map((district) => {
        const a = district.gridArea;
        const [cx, , cz] = point(a.x + a.width / 2 - 0.5, a.z + a.depth / 2 - 0.5);
        return (
          <group key={district.id}>
            <mesh
              position={[cx, 0.006, cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => onSelect(district.id, event)}
            >
              <planeGeometry args={[a.width * cell * 0.96, a.depth * cell * 0.96]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {(showLabels || districtNames.has(district.id)) && (
              <Html position={[cx, 0.2, cz]} center zIndexRange={[10, 0]} pointerEvents="none">
                <span className="district-label" data-traffic={district.traffic}>
                  {districtNames.get(district.id) ?? district.name}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
