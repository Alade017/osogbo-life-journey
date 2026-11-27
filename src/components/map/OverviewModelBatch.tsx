import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Group, InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Material } from "three";
import { useThree } from "@react-three/fiber";

/**
 * Batch repeated shared primitives inside a single model. Never combine different
 * destinations: each batch remains under its original interactive landmark group.
 * Source meshes are hidden and their raycasts disabled while their batches exist.
 */
export function OverviewModelBatch({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);
  const invalidate = useThree(state => state.invalidate);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(group.matrixWorld).invert();
    const matrix = new Matrix4();
    const buckets = new Map<BufferGeometry, Map<Material, Mesh[]>>();
    group.traverse(object => {
      if (!(object instanceof Mesh) || object instanceof InstancedMesh ||
          !object.visible || Array.isArray(object.material)) return;
      let materials = buckets.get(object.geometry);
      if (!materials) {
        materials = new Map();
        buckets.set(object.geometry, materials);
      }
      const meshes = materials.get(object.material) ?? [];
      meshes.push(object);
      materials.set(object.material, meshes);
    });
    const batches: InstancedMesh[] = [];
    const originals: { mesh: Mesh; visible: boolean; raycast: Mesh["raycast"] }[] = [];
    for (const [geometry, materials] of buckets) {
      for (const [material, meshes] of materials) {
        if (meshes.length < 2) continue;
        const batch = new InstancedMesh(geometry, material, meshes.length);
        meshes.forEach((mesh, index) => {
          batch.setMatrixAt(index, matrix.multiplyMatrices(inverse, mesh.matrixWorld));
          originals.push({ mesh, visible: mesh.visible, raycast: mesh.raycast });
          mesh.visible = false;
          mesh.raycast = () => {};
        });
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
        group.add(batch);
        batches.push(batch);
      }
    }
    invalidate();
    return () => {
      for (const batch of batches) {
        group.remove(batch);
        batch.dispose();
      }
      for (const { mesh, visible, raycast } of originals) {
        mesh.visible = visible;
        mesh.raycast = raycast;
      }
      invalidate();
    };
  }, [children, invalidate]);

  return <group ref={root}>{children}</group>;
}
