import { Bone, type Object3D, Skeleton, SkinnedMesh } from "three";

/**
 * Rebinds a rigged garment, exported on the same skeleton as the character, onto that character's
 * own bones. The garment then follows every clip the body plays. Returns the new meshes, which the
 * caller adds under the rig root, or an empty list when the garment's bones are not all present.
 */
export function bindGarment(garment: Object3D, rig: Object3D): SkinnedMesh[] {
  const bones = new Map<string, Bone>();
  rig.traverse((node) => {
    if (node instanceof Bone) bones.set(node.name, node);
  });
  const meshes: SkinnedMesh[] = [];
  let complete = true;
  garment.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    const matched = node.skeleton.bones.map((bone) => bones.get(bone.name));
    if (matched.some((bone) => !bone)) {
      complete = false;
      return;
    }
    const skeleton = new Skeleton(matched as Bone[], node.skeleton.boneInverses);
    const mesh = new SkinnedMesh(node.geometry, node.material);
    mesh.name = node.name;
    mesh.castShadow = true;
    mesh.bind(skeleton, node.bindMatrix);
    meshes.push(mesh);
  });
  return complete ? meshes : [];
}
