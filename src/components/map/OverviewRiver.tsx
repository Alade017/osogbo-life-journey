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
    {layout.terrain.river.bridges.map(bridge => {
      const { width, depth } = bridge.footprint;
      return <group key={bridge.id} position={[bridge.position.x - layout.meta.width / 2, 0, bridge.position.z - layout.meta.depth / 2]}>
        <mesh position={[0,0.35,0]}><boxGeometry args={[width,0.12,depth]}/><meshStandardMaterial color="#b4a58f"/></mesh>
        {[-1,1].map(side => <group key={side}>
          <mesh position={[0,0.58,side * depth * 0.44]}><boxGeometry args={[width,0.07,0.06]}/><meshStandardMaterial color="#766c5e"/></mesh>
          {[-0.4,0,0.4].map(f => <mesh key={f} position={[width*f,0.47,side*depth*0.44]}><boxGeometry args={[0.07,0.25,0.07]}/><meshStandardMaterial color="#766c5e"/></mesh>)}
          <mesh position={[side * width * 0.36,0.15,0]}><boxGeometry args={[0.22,0.3,depth]}/><meshStandardMaterial color="#a49b8c"/></mesh>
        </group>)}
      </group>;
    })}
  </>;
}
