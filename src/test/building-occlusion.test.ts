import { describe, expect, it } from "vitest";
import {
  approachOpacity,
  OCCLUDED_OPACITY,
  occlusionStyleFor,
} from "@/components/3d/building-occlusion";
import { foliageSwayAmplitude } from "@/components/3d/foliage-sway";
import { buildMinimapTelemetry } from "@/game/neighborhood-minimap";

describe("building occlusion", () => {
  it("cuts away on coarse pointers and fades on laptops", () => {
    expect(occlusionStyleFor({ coarsePointer: true })).toBe("cutaway");
    expect(occlusionStyleFor({ coarsePointer: false })).toBe("fade");
  });

  it("moves opacity toward the target without overshooting", () => {
    let value = 1;
    for (let frame = 0; frame < 120; frame += 1) {
      value = approachOpacity(value, OCCLUDED_OPACITY, 1 / 60);
    }
    expect(value).toBeGreaterThan(OCCLUDED_OPACITY - 0.01);
    expect(value).toBeGreaterThanOrEqual(OCCLUDED_OPACITY);
    expect(approachOpacity(0.5, 1, 0)).toBe(0.5);
  });
});

describe("foliage sway", () => {
  it("stops swaying when reduced motion is requested", () => {
    expect(foliageSwayAmplitude({ reducedMotion: true })).toBe(0);
    expect(foliageSwayAmplitude({ reducedMotion: false })).toBeGreaterThan(0);
  });
});

describe("neighbourhood minimap telemetry", () => {
  const bounds = { left: 0, top: 0, width: 200, height: 100 };

  it("normalises points into the neighbourhood and clamps the edges", () => {
    const telemetry = buildMinimapTelemetry({
      bounds,
      self: { x: 100, y: 25 },
      others: [{ x: -50, y: 150 }],
      target: null,
    });
    expect(telemetry.self).toEqual({ x: 0.5, y: 0.25 });
    expect(telemetry.others).toEqual([{ x: 0, y: 1 }]);
    expect(telemetry.target).toBeNull();
  });
});
