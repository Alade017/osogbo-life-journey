import { describe, expect, it } from "vitest";
import { BONE, poseFor } from "@/components/3d/humanoid-pose";
import { motionFor } from "@/components/3d/CharacterBody";

describe("motorcycle poses", () => {
  it("selects mounted task poses even while moving", () => {
    expect(motionFor("walk", true, "motorcycleDriver")).toBe("MotorcycleDriver");
    expect(motionFor("idle", false, "motorcyclePassenger")).toBe("MotorcyclePassenger");
  });
  it("uses symmetrical bent legs and different arm poses for driver and passenger", () => {
    const driver = poseFor("MotorcycleDriver", 0).bones;
    const passenger = poseFor("MotorcyclePassenger", 0).bones;
    expect(driver[BONE.lThigh]?.[0]).toBe(driver[BONE.rThigh]?.[0]);
    expect(driver[BONE.lCalf]?.[0]).toBeGreaterThan(0);
    expect(driver[BONE.lUpperArm]).not.toEqual(passenger[BONE.lUpperArm]);
    expect(poseFor("Sit", 0).bones[BONE.lThigh]).not.toEqual(driver[BONE.lThigh]);
  });
});
