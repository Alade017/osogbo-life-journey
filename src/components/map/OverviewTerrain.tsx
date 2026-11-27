import { useLayoutEffect, useRef } from "react";
import type { PlaneGeometry } from "three";
import layout from "@/data/osogbo-overview-layout.json";

const padding = 1.5;
const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };

/** Districts and river corridor remain level; only unoccupied peripheral land rises. */
export function overviewTerrainHeight(x: number, z: number): number {
  const distance = Math.min(...layout.districts.map(({ bounds: b }) =>
    Math.hypot(Math.max(b.x - x, 0, x - b.x - b.width),
      Math.max(b.z - z, 0, z - b.z - b.depth)),
  ));
  // Preserve the entire eastern river corridor, including interpolated banks.
  const riverEdge = Math.min(...layout.terrain.river.centerline.map(p => p.x)) - layout.terrain.river.width - 2;
  const weight = smooth((distance - padding) / 3) * smooth((riverEdge - x) / 3);
  return weight * (0.35 + 0.25 * Math.sin(x * 0.19) * Math.cos(z * 0.15));
}

export function OverviewTerrain() {
  const geometry = useRef<PlaneGeometry>(null);
  useLayoutEffect(() => {
    const mesh = geometry.current;
    if (!mesh) return;
    const positions = mesh.attributes.position;
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + layout.meta.width / 2;
      const z = -positions.getY(i) + layout.meta.depth / 2;
      positions.setZ(i, overviewTerrainHeight(x, z) - 0.015);
    }
    positions.needsUpdate = true;
    mesh.computeVertexNormals();
    mesh.computeBoundingSphere();
  }, []);
  return <mesh rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry ref={geometry} args={[layout.meta.width, layout.meta.depth, 100, 100]} />
    <meshStandardMaterial color="#9aa77c" roughness={0.95} />
  </mesh>;
}
