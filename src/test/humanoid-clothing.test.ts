import { expect, it } from "vitest";
import { Vector3 } from "three";
import { createHumanoid } from "@/components/3d/humanoid-rig";
import { createFittedClothing } from "@/components/3d/humanoid-clothing";
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
