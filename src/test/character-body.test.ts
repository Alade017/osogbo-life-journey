import { describe, expect, it } from "vitest";
import { motionFor } from "@/components/3d/CharacterBody";
import { BONE, poseFor, type PoseMotion } from "@/components/3d/humanoid-pose";
import { createHumanoid, JOINTS } from "@/components/3d/humanoid-rig";
import { CHARACTER_GROUND } from "@/components/3d/character-config";
import { SkinnedMesh } from "three";

const MOTIONS: PoseMotion[] = [
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

describe("motionFor", () => {
  it("walks whenever the character is moving", () => {
    expect(motionFor("idle", true)).toBe("Walk");
    expect(motionFor("work", true)).toBe("Walk");
  });

  it("maps the standing states to their poses", () => {
    expect(motionFor("work", false)).toBe("Work");
    expect(motionFor("interact", false)).toBe("Interact");
    expect(motionFor("talk", false)).toBe("Talk");
    expect(motionFor("idle", false)).toBe("Idle");
    expect(motionFor("sleep", false)).toBe("Idle");
  });

  it("gives task poses priority over walking and the standing states", () => {
    expect(motionFor("idle", true, "sit")).toBe("Sit");
    expect(motionFor("work", false, "cook")).toBe("Cook");
    expect(motionFor("idle", false, "stretch")).toBe("Stretch");
  });
});

describe("poses", () => {
  it("only names bones that exist on the rig", () => {
    const names = new Set(JOINTS.map((joint) => joint.name));
    for (const motion of MOTIONS) {
      for (const bone of Object.keys(poseFor(motion, 1.3).bones)) {
        expect(names.has(bone as never)).toBe(true);
      }
    }
  });

  it("returns finite angles at any time", () => {
    for (const motion of MOTIONS) {
      for (const t of [0, 0.4, 3.7, 120]) {
        const pose = poseFor(motion, t);
        for (const angles of Object.values(pose.bones)) {
          expect(angles!.every((value) => Number.isFinite(value))).toBe(true);
        }
      }
    }
  });

  it("swings the legs in opposite phase while walking", () => {
    const pose = poseFor("Walk", 0.2);
    const left = pose.bones[BONE.lThigh]![0];
    const right = pose.bones[BONE.rThigh]![0];
    expect(left).toBeCloseTo(-right, 6);
  });

  it("raises both arms overhead when stretching", () => {
    const pose = poseFor("Stretch", 0);
    expect(pose.bones[BONE.lUpperArm]![0]).toBeLessThan(-2.5);
    expect(pose.bones[BONE.rUpperArm]![0]).toBeLessThan(-2.5);
  });
});

describe("humanoid rig", () => {
  it("builds an 18-bone biped with the names the wardrobe attaches to", () => {
    const rig = createHumanoid({ variant: "male", skinColor: "#8a5a3b", hairColor: "#1b1410" });
    expect(rig.bones).toHaveLength(18);
    for (const name of [
      "Bip01 Spine",
      "Bip01 Spine1",
      "Bip01 Spine2",
      "Bip01 L UpperArm",
      "Bip01 R Forearm",
      "Bip01 L Thigh",
      "Bip01 R Calf",
      "Bip01 L Foot",
      "Bip01 R Hand",
    ]) {
      expect(rig.byName.has(name)).toBe(true);
    }
  });

  it("stands 1.0 tall with the feet on the origin", () => {
    const rig = createHumanoid({ variant: "female", skinColor: "#5a3825", hairColor: null });
    rig.root.updateMatrixWorld(true);
    const feet = [rig.byName.get(BONE.lFoot)!, rig.byName.get(BONE.rFoot)!];
    for (const foot of feet) expect(foot.getWorldPosition(foot.position).y).toBeGreaterThan(0);
    const head = rig.byName.get(BONE.head)!;
    expect(head.getWorldPosition(head.position).y + 0.09 * 1.15).toBeLessThanOrEqual(1.01);
  });

  it("keeps the body within a low triangle budget", () => {
    const rig = createHumanoid({ variant: "male", skinColor: "#8a5a3b", hairColor: null });
    const body = rig.meshes[0] as SkinnedMesh;
    // The body is unindexed (skin and feature materials are merged as groups), so count corners.
    const triangles =
      (body.geometry.index?.count ?? body.geometry.attributes["position"]!.count) / 3;
    expect(triangles).toBeLessThan(4500);
  });

  it("skips the hair mesh for bald characters", () => {
    expect(
      createHumanoid({ variant: "male", skinColor: "#000", hairColor: null }).meshes,
    ).toHaveLength(1);
    expect(
      createHumanoid({ variant: "male", skinColor: "#000", hairColor: "#111" }).meshes,
    ).toHaveLength(2);
  });

  it("keeps the shadow tuning available to the ground shadow", () => {
    expect(CHARACTER_GROUND.shadowRadius).toBeGreaterThan(0);
  });
});
