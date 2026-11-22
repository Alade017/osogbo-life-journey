import { expect, it } from "vitest";
import { Vector3 } from "three";
import { createHumanoid } from "@/components/3d/humanoid-rig";
import { createFittedClothing, createVisibleSkin } from "@/components/3d/humanoid-clothing";
import {
  BONE,
  poseFor,
  ROOT_REST_Y,
  type BoneName,
  type PoseMotion,
} from "@/components/3d/humanoid-pose";
it.each(["male", "female"] as const)(
  "fits the %s outfit to the real skin and shares all animation weights",
  (variant) => {
    const rig = createHumanoid({ variant, skinColor: "#754c32", hairColor: null });
    const body = rig.meshes[0]!;
    const outfit = createFittedClothing(body, ["#2f9e5b", "#27334a", "#22242a"], false);
    expect(outfit.skeleton).toBe(body.skeleton);
    expect(outfit.geometry.groups).toHaveLength(3);
    expect(outfit.geometry.getAttribute("position").count).toBeGreaterThan(1000);
    const p = body.geometry.getAttribute("position"),
      q = outfit.geometry.getAttribute("position");
    expect(q.count).toBeLessThan(p.count);
    const weights = outfit.geometry.getAttribute("skinWeight");
    for (let i = 0; i < q.count; i += 17) {
      expect(
        [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)].reduce(
          (a, b) => a + b,
          0,
        ),
      ).toBeCloseTo(1);
      expect(q.getY(i)).toBeGreaterThan(-0.02);
      expect(q.getY(i)).toBeLessThan(0.86);
    }
    for (const motion of [
      "Idle",
      "Walk",
      "Work",
      "Talk",
      "Interact",
      "Sit",
      "Wash",
      "Cook",
      "Collect",
      "Stretch",
      "Dance",
    ] as PoseMotion[]) {
      const pose = poseFor(motion, 0.7);
      for (const bone of rig.bones)
        bone.rotation.set(...(pose.bones[bone.name as BoneName] ?? [0, 0, 0]));
      rig.root.position.y = ROOT_REST_Y + (pose.rootY ?? 0);
      rig.root.updateMatrixWorld(true);
      outfit.skeleton.update();
      for (let i = 0; i < q.count; i += 31) {
        const point = outfit.applyBoneTransform(i, new Vector3().fromBufferAttribute(q, i));
        expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true);
      }
    }
    expect(rig.byName.has(BONE.lHand)).toBe(true);
  },
);
it("reuses the sculpt across hair choices while retaining independent skeletons", () => {
  const a = createHumanoid({
      variant: "male",
      hairShape: "afro",
      skinColor: "#754c32",
      hairColor: "#111111",
    }),
    b = createHumanoid({
      variant: "male",
      hairShape: "cap",
      skinColor: "#754c32",
      hairColor: "#111111",
    });
  expect(a.meshes[0]!.geometry).toBe(b.meshes[0]!.geometry);
  expect(a.root).not.toBe(b.root);
});

it("switches sleeve geometry on the same skeleton without changing the body", () => {
  const rig = createHumanoid({ variant: "female", skinColor: "#754c32", hairColor: null }),
    body = rig.meshes[0]!;
  const tee = createFittedClothing(body, ["#eeeeee", "#333333", "#111111"], false, "tee");
  const long = createFittedClothing(body, ["#b96643", "#333333", "#111111"], false, "long-sleeve");
  expect(long.skeleton).toBe(tee.skeleton);
  expect(long.geometry).not.toBe(tee.geometry);
  expect(long.geometry.groups[0]!.count).toBeGreaterThan(tee.geometry.groups[0]!.count);
});

it.each(["male", "female"] as const)(
  "keeps the dressed %s render within the mobile triangle budget",
  (variant) => {
    const rig = createHumanoid({ variant, skinColor: "#754c32", hairColor: "#111111" }),
      body = rig.meshes[0]!;
    for (const cut of ["tee", "long-sleeve"] as const) {
      const exposed = createVisibleSkin(body, cut),
        outfit = createFittedClothing(body, ["#eeeeee", "#333333", "#111111"], false, cut);
      const triangles = (mesh: typeof body) =>
        (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3;
      expect(
        triangles(exposed) +
          triangles(outfit) +
          rig.meshes.slice(1).reduce((sum, m) => sum + triangles(m), 0),
      ).toBeLessThanOrEqual(10000);
      expect(exposed.skeleton).toBe(body.skeleton);
      expect(exposed.material).toBe(body.material);
    }
  },
);

it("keeps garment weights finite with missing or invalid source influences", () => {
  const rig = createHumanoid({ variant: "male", skinColor: "#754c32", hairColor: null });
  const body = rig.meshes[0]!;
  body.geometry = body.geometry.clone();
  const weights = body.geometry.getAttribute("skinWeight");
  const indices = body.geometry.getAttribute("skinIndex");
  for (let i = 0; i < weights.count; i++) {
    weights.setXYZW(i, 0, Number.NaN, -1, 1);
    indices.setXYZW(i, 0, 0, 0, rig.bones.length);
  }
  const outfit = createFittedClothing(body, ["#eeeeee", "#333333", "#111111"], false);
  const result = outfit.geometry.getAttribute("skinWeight");
  const resultIndices = outfit.geometry.getAttribute("skinIndex");
  expect(result.count).toBeGreaterThan(0);
  for (let i = 0; i < result.count; i++) {
    expect(result.getX(i)).toBe(1);
    expect(result.getY(i)).toBe(0);
    expect(result.getZ(i)).toBe(0);
    expect(result.getW(i)).toBe(0);
    expect(resultIndices.getX(i)).toBe(0);
  }
  expect(() => createVisibleSkin(body)).not.toThrow();
});
