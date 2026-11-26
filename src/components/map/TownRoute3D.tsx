import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { type TownRoute } from "@/game/town-route";
import { WORLD_SCALE } from "@/components/3d/world-theme";
import town from "@/data/osogbo-town.json";
const cell = WORLD_SCALE.townCell;
const point = (x: number, z: number): [number, number, number] => [
  (x - (town.meta.grid.columns - 1) / 2) * cell,
  0.13,
  (z - (town.meta.grid.rows - 1) / 2) * cell,
];
/** A single ribbon mesh: right-angle road cells stay right-angle, with no smoothing through plots. */
export function TownRoute3D({ route, walking }: { route: TownRoute; walking: boolean }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [],
      half = cell * 0.055;
    for (let i = 1; i < route.cells.length; i++) {
      const a = point(...route.cells[i - 1]!),
        b = point(...route.cells[i]!);
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz),
        ox = (-dz / length) * half,
        oz = (dx / length) * half;
      const corners = [
        [a[0] + ox, a[1], a[2] + oz],
        [a[0] - ox, a[1], a[2] - oz],
        [b[0] + ox, b[1], b[2] + oz],
        [b[0] - ox, b[1], b[2] - oz],
      ];
      for (const j of [0, 1, 2, 2, 1, 3]) vertices.push(...corners[j]!);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const tone = walking ? "#f6d17c" : "#7be5ee";
  return (
    <group name="destination-road-route">
      <mesh geometry={geometry}>
        <meshBasicMaterial color={tone} side={DoubleSide} />
      </mesh>
      <mesh position={point(...route.start)} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cell * 0.12, cell * 0.19, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={point(...route.end)} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cell * 0.17, cell * 0.24, 24]} />
        <meshBasicMaterial color={tone} />
      </mesh>
    </group>
  );
}
