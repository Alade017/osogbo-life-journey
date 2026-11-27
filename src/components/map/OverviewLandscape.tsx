import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import layout from "@/data/osogbo-overview-layout.json";
import { overviewRiverDistance, overviewRiverBankWidth } from "./overview-river-layout";
import { overviewBillboards } from "./overview-billboard-placement";

type Tree = { x: number; z: number; height: number };
const trees: Tree[] = [];
const occupied = [...layout.places, ...layout.residentialParcels, ...layout.commercialParcels, ...layout.terrain.river.bridges, ...overviewBillboards];
function nearRiver(x: number, z: number) {
  return overviewRiverDistance(x,z) < overviewRiverBankWidth/2 + 0.85;
}
for (const district of layout.districts) {
  const b = district.bounds;
  const step = district.districtId === "riverside" ? 2 : 4;
  for (let x = b.x + 0.6; x < b.x + b.width - 0.6; x += step) {
    for (let z = b.z + 0.6; z < b.z + b.depth - 0.6; z += step) {
      if (nearRiver(x,z) || occupied.some(p => Math.abs(p.position.x - x) < p.footprint.width / 2 + 0.65 &&
          Math.abs(p.position.z - z) < p.footprint.depth / 2 + 0.65)) continue;
      trees.push({ x: x - layout.meta.width / 2, z: z - layout.meta.depth / 2,
        height: 0.95 + (Math.sin(x * 7 + z * 13) + 1) * 0.35 });
    }
  }
}

/** Static landscaping avoids occupied plots and uses two instanced draw batches. */
export function OverviewLandscape() {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const object = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    trees.forEach((tree, index) => {
      object.position.set(tree.x, tree.height * 0.24, tree.z);
      object.scale.set(0.12, tree.height * 0.48, 0.12);
      object.updateMatrix();
      trunks.current!.setMatrixAt(index, object.matrix);
      object.position.set(tree.x, tree.height * 0.73, tree.z);
      object.scale.set(tree.height * 0.38, tree.height * 0.44, tree.height * 0.38);
      object.updateMatrix();
      crowns.current!.setMatrixAt(index, object.matrix);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [object]);
  return <>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
      <meshStandardMaterial color="#80634a" />
    </instancedMesh>
    <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#557848" />
    </instancedMesh>
  </>;
}
