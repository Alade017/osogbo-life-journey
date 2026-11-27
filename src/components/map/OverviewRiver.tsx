import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, Vector3, CatmullRomCurve3, DoubleSide } from "three";
import layout from "@/data/osogbo-overview-layout.json";

function ribbon(points: Vector3[], width: number, elevation: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const dx = after.x - before.x, dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    vertices.push(p.x + nx, elevation, p.z + nz, p.x - nx, elevation, p.z - nz);
    if (i > 0) {
      const k = i * 2;
      indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Connected static water and bank surfaces, independent of the navigation grid. */
export function OverviewRiver() {
  const { water, banks } = useMemo(() => {
    const river = layout.terrain.river;
    const points = river.centerline.map(p => new Vector3(
      p.x - layout.meta.width / 2, 0, p.z - layout.meta.depth / 2,
    ));
    const curve = new CatmullRomCurve3(points);
    const sampled = curve.getPoints(Math.max(24, (points.length - 1) * 12));
    return { water: ribbon(sampled, river.width, 0.045),
      banks: ribbon(sampled, river.width + 0.65, 0.025) };
  }, []);
  useEffect(() => () => { water.dispose(); banks.dispose(); }, [water, banks]);
  return <>
    <mesh geometry={banks}><meshStandardMaterial color="#819166" side={DoubleSide}/></mesh>
    <mesh geometry={water}><meshStandardMaterial color="#568b9b" roughness={0.32} side={DoubleSide}/></mesh>
  </>;
}
