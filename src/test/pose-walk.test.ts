import { describe, expect, it } from "vitest";
import { BONE, POSE_STYLE, poseFor } from "@/components/3d/humanoid-pose";

describe("walk pose", () => {
  it("keeps every walk angle finite and calves bending only one way", () => {
    for (let i = 0; i < 200; i += 1) {
      const pose = poseFor("Walk", i / 30, POSE_STYLE.female);
      for (const angles of Object.values(pose.bones)) {
        for (const value of angles!) expect(Number.isFinite(value)).toBe(true);
      }
      expect(pose.bones[BONE.lCalf]![0]).toBeLessThanOrEqual(0);
      expect(pose.bones[BONE.rCalf]![0]).toBeLessThanOrEqual(0);
    }
  });

  it("swings the female hips further than the male hips", () => {
    const t = 0.1;
    const female = poseFor("Walk", t, POSE_STYLE.female).bones[BONE.root]![2];
    const male = poseFor("Walk", t, POSE_STYLE.male).bones[BONE.root]![2];
    expect(Math.abs(female)).toBeGreaterThan(Math.abs(male));
  });
});
