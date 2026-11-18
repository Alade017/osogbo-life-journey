import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createHumanoid } from "@/components/3d/humanoid-rig";
import { BONE, poseFor, ROOT_REST_Y, type PoseMotion } from "@/components/3d/humanoid-pose";
const motions: PoseMotion[] = [
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
];
describe("rebuilt humanoid animation coverage", () => {
  it.each(
    (["male", "female"] as const).flatMap((variant) =>
      motions.map((motion) => ({ variant, motion })),
    ),
  )("$variant deforms safely throughout $motion", ({ variant, motion }) => {
    const rig = createHumanoid({ variant, skinColor: "#754c32", hairColor: null });
    for (const t of [0, 0.25, 0.7, 1.5]) {
      const pose = poseFor(motion, t);
      for (const bone of rig.bones) {
        const e = pose.bones[bone.name as keyof typeof pose.bones];
        bone.rotation.set(...(e ?? [0, 0, 0]));
      }
      rig.root.position.y = ROOT_REST_Y + (pose.rootY ?? 0);
      rig.root.updateMatrixWorld(true);
      rig.meshes[0]!.skeleton.update();
      const mesh = rig.meshes[0]!,
        points = mesh.geometry.getAttribute("position");
      for (let i = 0; i < points.count; i += 7) {
        const p = new Vector3().fromBufferAttribute(points, i);
        mesh.applyBoneTransform(i, p);
        if (
          ![p.x, p.y, p.z].every(Number.isFinite) ||
          Math.abs(p.x) > 1 ||
          p.y < -0.4 ||
          p.y > 1.5 ||
          Math.abs(p.z) > 1
        )
          throw new Error(`${variant} ${motion} invalid vertex at ${t}`);
      }
    }
  });
  it("never skins the outer thigh to a hanging hand", () => {
    const rig = createHumanoid({
      variant: "female",
      build: 3,
      skinColor: "#754c32",
      hairColor: null,
    });
    const g = rig.meshes[0]!.geometry,
      points = g.getAttribute("position"),
      bones = g.getAttribute("skinIndex"),
      weights = g.getAttribute("skinWeight");
    const forbidden = new Set([BONE.lHand, BONE.rHand, BONE.lForearm, BONE.rForearm] as string[]);
    for (let i = 0; i < points.count; i++)
      if (points.getY(i) > 0.4 && points.getY(i) < 0.49 && Math.abs(points.getX(i)) < 0.17) {
        for (let j = 0; j < 4; j++)
          if (weights.getComponent(i, j) > 0)
            expect(forbidden.has(rig.bones[bones.getComponent(i, j)]!.name)).toBe(false);
      }
  });
});
