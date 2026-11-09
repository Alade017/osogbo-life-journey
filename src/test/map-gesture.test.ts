import { describe, expect, it } from "vitest";
import {
  isQuickMapTap,
  mapPinchZoomFactor,
  MAP_TAP_MAX_DISTANCE,
  MAP_TAP_MAX_DURATION_MS,
} from "@/lib/map-gesture";
import {
  isMapTargetSelectionAllowed,
  MAP_DRAG_THRESHOLD_PX,
  MAP_TARGET_MAX_POINTER_DELTA,
} from "@/game/map-gesture";

describe("map tap gesture threshold", () => {
  it("accepts a short press with less than six pixels of movement", () => {
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 23, y: 22, at: 380 })).toBe(true);
  });

  it("treats six pixels of movement or a long press as a map gesture", () => {
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 26, y: 20, at: 200 })).toBe(false);
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 20, y: 20, at: 601 })).toBe(false);
  });

  it("retains the existing movement and duration thresholds", () => {
    expect(MAP_TAP_MAX_DISTANCE).toBe(6);
    expect(MAP_TAP_MAX_DURATION_MS).toBe(500);
  });
});

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

describe("map pinch zoom", () => {
  it("zooms in when pointer distance increases", () => {
    expect(mapPinchZoomFactor(100, 125)).toBe(1.25);
  });

  it("zooms out when pointer distance decreases", () => {
    expect(mapPinchZoomFactor(100, 80)).toBe(0.8);
  });

  it("rejects zero, negative, and non-finite distances", () => {
    expect(mapPinchZoomFactor(0, 20)).toBeNull();
    expect(mapPinchZoomFactor(20, 0)).toBeNull();
    expect(mapPinchZoomFactor(-1, 20)).toBeNull();
    expect(mapPinchZoomFactor(20, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
