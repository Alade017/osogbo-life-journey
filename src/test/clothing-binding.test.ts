import { describe, expect, it } from "vitest";
import { BoxGeometry, Bone, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from "three";
import { bindGarment } from "@/components/3d/clothing-binding";

function rigWith(names: string[]) {
  const root = new Group();
  const bones = names.map((name) => {
    const bone = new Bone();
    bone.name = name;
    root.add(bone);
    return bone;
  });
  return { root, bones };
}

function garmentOn(names: string[]) {
  const { root, bones } = rigWith(names);
  const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.add(bones[0]!);
  mesh.bind(new Skeleton(bones));
  const group = new Group();
  group.add(mesh);
  void root;
  return group;
}

describe("bindGarment", () => {
  it("binds a garment to the rig's own bones by name", () => {
    const rig = rigWith(["Bip01 Spine2", "Bip01 Pelvis"]);
    const garment = garmentOn(["Bip01 Spine2", "Bip01 Pelvis"]);
    const [mesh] = bindGarment(garment, rig.root);
    expect(mesh).toBeDefined();
    expect(mesh!.skeleton.bones[0]).toBe(rig.bones[0]);
    expect(mesh!.skeleton.bones[1]).toBe(rig.bones[1]);
  });

  it("returns nothing when a garment bone is missing from the rig", () => {
    const rig = rigWith(["Bip01 Spine2"]);
    const garment = garmentOn(["Bip01 Spine2", "Bip01 L Toe0"]);
    expect(bindGarment(garment, rig.root)).toEqual([]);
  });
});
