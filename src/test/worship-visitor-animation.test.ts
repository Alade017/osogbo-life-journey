import { describe, expect, it } from "vitest";
import { nextPrayerPose } from "@/components/3d/WorshipInterior3D";

describe("worship visitor pose interpolation", () => {
  it("preserves the original easing formula", () => {
    expect(nextPrayerPose(0, 1, 0.1)).toBeCloseTo(0.4, 6);
  });

  it("approaches the prayer pose without overshooting", () => {
    let pose = 0;
    for (let i = 0; i < 30; i++) {
      const next = nextPrayerPose(pose, 1, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(pose);
      expect(next).toBeLessThanOrEqual(1);
      pose = next;
    }
    expect(pose).toBeGreaterThan(0);
  });

  it("settles exactly at the prayer target", () => {
    let pose = 0;
    for (let i = 0; i < 240; i++) pose = nextPrayerPose(pose, 1, 1 / 60);
    expect(pose).toBe(1);
  });

  it("returns exactly to the standing pose", () => {
    let pose = 1;
    for (let i = 0; i < 240; i++) pose = nextPrayerPose(pose, 0, 1 / 60);
    expect(pose).toBe(0);
  });

  it("preserves an already settled pose", () => {
    expect(nextPrayerPose(0, 0, 1 / 60)).toBe(0);
    expect(nextPrayerPose(1, 1, 1 / 60)).toBe(1);
  });

  it("supports a large frame delta without overshooting", () => {
    expect(nextPrayerPose(0, 1, 1)).toBe(1);
    expect(nextPrayerPose(1, 0, 1)).toBe(0);
  });
});
