import { describe, expect, it } from "vitest";
import { busParts, tukTukParts, type PropPart } from "../components/3d/props/procedural-props.ts";

function bounds(parts: readonly PropPart[]) {
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

describe("bus", () => {
  const parts = busParts({ length: 9, width: 2.5, height: 3 });
  it("is yellow with glass and wheels, and sits on the ground", () => {
    const tones = new Set(parts.map((p) => p.tone));
    expect(tones.has("jerrycan")).toBe(true);
    expect(tones.has("glass")).toBe(true);
    expect(tones.has("roof")).toBe(true);
    expect(bounds(parts).minY).toBeCloseTo(0, 1);
  });
  it("matches its requested size", () => {
    const b = bounds(parts);
    expect(b.maxX - b.minX).toBeCloseTo(9, 1);
    expect(b.maxY).toBeGreaterThan(2.5);
    expect(b.maxY).toBeLessThan(3.5);
  });
});

describe("tuk-tuk", () => {
  const parts = tukTukParts({ length: 2.4, width: 1.2 });
  it("uses the accent cab with a canopy and wheels", () => {
    const tones = new Set(parts.map((p) => p.tone));
    expect(tones.has("accent")).toBe(true);
    expect(tones.has("metal")).toBe(true);
    expect(bounds(parts).minY).toBeCloseTo(0, 1);
  });
  it("stays within a small footprint and a low height", () => {
    const b = bounds(parts);
    expect(b.maxX - b.minX).toBeLessThan(2.6);
    expect(b.maxZ - b.minZ).toBeLessThan(1.7);
    expect(b.maxY).toBeLessThan(1.9);
  });
});
