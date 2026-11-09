import { describe, expect, it } from "vitest";
import { worldBuildingSurfaces, worldFoliageColor } from "@/components/3d/world-theme";

describe("procedural world material palettes", () => {
  it("returns stable foliage colours for the same map-derived seed", () => {
    expect(worldFoliageColor(137)).toBe(worldFoliageColor(137));
    expect(worldFoliageColor(137)).not.toBe(worldFoliageColor(138));
    expect(worldFoliageColor(-137)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("returns complete, stable building surfaces without location-specific rules", () => {
    const first = worldBuildingSurfaces(241);
    expect(worldBuildingSurfaces(241)).toEqual(first);
    expect(first.wall).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.roof).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.trim).toMatch(/^#[0-9a-f]{6}$/i);
    expect(worldBuildingSurfaces(242)).not.toEqual(first);
  });
});
