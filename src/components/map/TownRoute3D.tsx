import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh } from "three";
import { sampleTownRoute, type TownRoute } from "@/game/town-route";
import { WORLD_SCALE } from "@/components/3d/world-theme";
import town from "@/data/osogbo-town.json";
const cell = WORLD_SCALE.townCell;
const point = (x: number, z: number): [number, number, number] => [
  (x - (town.meta.grid.columns - 1) / 2) * cell,
  0.13,
  (z - (town.meta.grid.rows - 1) / 2) * cell,
];
/** A single ribbon mesh: right-angle road cells stay right-angle, with no smoothing through plots. */
export function TownRoute3D({
  route,
  walking,
  pending,
}: {
  route: TownRoute;
  walking: boolean;
  pending: boolean;
}) {
  const marker = useRef<Mesh>(null),
    elapsed = useRef(0);
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
  useEffect(() => {
    elapsed.current = 0;
  }, [route, pending]);
  useFrame((_, delta) => {
    if (!marker.current) return;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (pending && !reduced) elapsed.current += Math.min(delta, 0.1);
    const p = sampleTownRoute(route.cells, pending && !reduced ? (elapsed.current % 3) / 3 : 0);
    if (p) {
      const world = point(...p);
      marker.current.position.set(world[0], 0.55, world[2]);
    }
  });
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
      <mesh ref={marker} position={point(...route.start)}>
        <sphereGeometry args={[cell * 0.12, 12, 8]} />
        <meshBasicMaterial color={tone} />
      </mesh>
    </group>
  );
}
