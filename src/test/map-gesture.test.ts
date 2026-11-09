import { describe, expect, it } from "vitest";
import {
  isMapTargetSelectionAllowed,
  MAP_DRAG_THRESHOLD_PX,
  MAP_TARGET_MAX_POINTER_DELTA,
} from "@/game/map-gesture";

describe("town map target gesture selection", () => {
  it("allows landmark callbacks without a Three.js pointer event", () => {
    expect(isMapTargetSelectionAllowed(undefined, false)).toBe(true);
  });

  it("allows taps within the pointer delta tolerance", () => {
    expect(isMapTargetSelectionAllowed(0, false)).toBe(true);
    expect(isMapTargetSelectionAllowed(MAP_TARGET_MAX_POINTER_DELTA, false)).toBe(true);
  });

  it("rejects clicks with a large pointer delta", () => {
    expect(isMapTargetSelectionAllowed(MAP_TARGET_MAX_POINTER_DELTA + 1, false)).toBe(false);
  });

  it("rejects gestures already classified as camera drags", () => {
    expect(isMapTargetSelectionAllowed(0, true)).toBe(false);
  });

  it("keeps the drag threshold larger than the target click tolerance", () => {
    expect(MAP_DRAG_THRESHOLD_PX).toBeGreaterThan(MAP_TARGET_MAX_POINTER_DELTA);
  });
});
