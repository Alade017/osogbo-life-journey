import { expect, it } from "vitest";
import { createHumanoid } from "@/components/3d/humanoid-rig";
import { BONE } from "@/components/3d/humanoid-pose";
import { Vector3 } from "three";
it.each(["male", "female"] as const)(
  "keeps the %s model within adult proportion limits",
  (variant) => {
    const rig = createHumanoid({ variant, skinColor: "#6e452c", hairColor: null });
    const p = rig.meshes[0]!.geometry.getAttribute("position");
    let headMin = Infinity,
      headMax = -Infinity,
      chestMin = Infinity,
      chestMax = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0.89) {
        headMin = Math.min(headMin, p.getX(i));
        headMax = Math.max(headMax, p.getX(i));
      }
      if (p.getY(i) > 0.7 && p.getY(i) < 0.8) {
        chestMin = Math.min(chestMin, p.getX(i));
        chestMax = Math.max(chestMax, p.getX(i));
      }
    }
    expect(headMax - headMin).toBeLessThan(0.125);
    expect(chestMax - chestMin).toBeLessThan(0.38);
    const shoulder = rig.byName.get(BONE.lUpperArm)!.getWorldPosition(new Vector3());
    expect(shoulder.x).toBeLessThan(0.15);
    expect(shoulder.y).toBeCloseTo(0.76);
  },
);
it("uses actual nose depth and multiple separated fingertips rather than a featureless face and mittens", () => {
  const rig = createHumanoid({ variant: "male", skinColor: "#6e452c", hairColor: null }),
    p = rig.meshes[0]!.geometry.getAttribute("position");
  let nose = -Infinity,
    forehead = -Infinity;
  const tips = new Set<number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (Math.abs(x) < 0.008 && y > 0.9 && y < 0.916) nose = Math.max(nose, z);
    if (Math.abs(x) < 0.008 && y > 0.965 && y < 0.985) forehead = Math.max(forehead, z);
    if (x > 0.14 && y > 0.36 && y < 0.39) tips.add(Math.round(x * 1000));
  }
  expect(nose - forehead).toBeGreaterThan(0.015);
  expect(tips.size).toBeGreaterThan(10);
});
