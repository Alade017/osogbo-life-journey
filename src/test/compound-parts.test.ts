import { describe, expect, it } from "vitest";
import { compoundParts } from "../components/3d/props/procedural-props.ts";

function bounds(parts: ReturnType<typeof compoundParts>) {
  const box = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    const b = p.geometry.boundingBox!;
    box.minX = Math.min(box.minX, b.min.x);
    box.maxX = Math.max(box.maxX, b.max.x);
    box.minY = Math.min(box.minY, b.min.y);
    box.maxY = Math.max(box.maxY, b.max.y);
    box.minZ = Math.min(box.minZ, b.min.z);
    box.maxZ = Math.max(box.maxZ, b.max.z);
  }
  return box;
}

describe("compound parts", () => {
  const width = 3.6;
  const depth = 2.1;
  const parts = compoundParts({ width, depth });

  it("uses walls, concrete, timber, a door and a rusted roof", () => {
    const tones = new Set(parts.map((p) => p.tone));
    for (const tone of ["wall", "concrete", "timber", "door", "rust", "metal"])
      expect(tones.has(tone as never)).toBe(true);
  });

  it("stays inside its footprint", () => {
    const b = bounds(parts);
    expect(b.minX).toBeGreaterThanOrEqual(-width / 2 - 1e-6);
    expect(b.maxX).toBeLessThanOrEqual(width / 2 + 1e-6);
    expect(b.minZ).toBeGreaterThanOrEqual(-depth / 2 - 1e-6);
    expect(b.maxZ).toBeLessThanOrEqual(depth / 2 + 1e-6);
    expect(b.minY).toBeCloseTo(0, 5);
  });

  it("rises to a roof above the wall but below a storey and a half", () => {
    const b = bounds(parts);
    expect(b.maxY).toBeGreaterThan(2.6);
    expect(b.maxY).toBeLessThan(3.6);
  });
});
