import { describe, expect, it } from "vitest";
import { bankTowerParts, triangleCount } from "../components/3d/props/procedural-props.ts";
import { WORLD_PALETTE } from "../components/3d/world-theme.ts";

describe("bank tower", () => {
  const parts = bankTowerParts({ width: 6, depth: 6, height: 14 });

  it("is built from glass and concrete, with a metal plant box", () => {
    const tones = new Set(parts.map((p) => p.tone));
    expect(tones).toEqual(new Set(["glass", "concrete", "metal"]));
    for (const tone of tones) expect(WORLD_PALETTE[tone]).toBeDefined();
  });

  it("stays within its footprint and rises to the requested height plus roof", () => {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of parts) {
      p.geometry.computeBoundingBox();
      const box = p.geometry.boundingBox!;
      minX = Math.min(minX, box.min.x);
      maxX = Math.max(maxX, box.max.x);
      minY = Math.min(minY, box.min.y);
      maxY = Math.max(maxY, box.max.y);
      minZ = Math.min(minZ, box.min.z);
      maxZ = Math.max(maxZ, box.max.z);
    }
    expect(minX).toBeGreaterThanOrEqual(-3.2);
    expect(maxX).toBeLessThanOrEqual(3.2);
    expect(minZ).toBeGreaterThanOrEqual(-3.2);
    expect(maxZ).toBeLessThanOrEqual(3.2);
    expect(minY).toBeCloseTo(0, 5);
    expect(maxY).toBeGreaterThan(14);
    expect(maxY).toBeLessThan(17);
  });

  it("has a modest triangle budget", () => {
    expect(triangleCount(parts)).toBeLessThan(2000);
  });
});
