import { describe, expect, it } from "vitest";
import { Box3 } from "three";
import {
  dyeVatParts,
  jerrycanStackParts,
  marketUmbrellaParts,
  mergeParts,
  palmTreeParts,
  triangleCount,
  waterTankParts,
  type PropPart,
} from "../components/3d/props/procedural-props.ts";
import { WORLD_PALETTE } from "../components/3d/world-theme.ts";

function boundsOf(parts: readonly PropPart[]) {
  const box = new Box3();
  for (const item of parts) {
    item.geometry.computeBoundingBox();
    box.union(item.geometry.boundingBox!);
  }
  return box;
}

describe("procedural props", () => {
  it("builds a palm whose crown reaches the trunk top and whose fronds spread out", () => {
    const parts = palmTreeParts({ height: 6, frondLength: 2.4 });
    const box = boundsOf(parts);
    expect(box.max.y).toBeGreaterThan(6);
    expect(box.max.y).toBeLessThan(6 + 2.4 + 0.5);
    expect(box.max.x - box.min.x).toBeGreaterThan(2.4);
    expect(triangleCount(parts)).toBeLessThan(2000);
  });

  it("builds a market umbrella with a canopy above its pole", () => {
    const parts = marketUmbrellaParts({ height: 2, radius: 1 });
    const box = boundsOf(parts);
    expect(box.min.y).toBeCloseTo(0, 1);
    expect(box.max.y).toBeGreaterThan(2);
    expect(box.max.x - box.min.x).toBeGreaterThan(1.8);
    expect(triangleCount(parts)).toBeLessThan(400);
  });

  it("stacks jerrycans into the requested grid, one yellow box per can", () => {
    const parts = jerrycanStackParts({ columns: 3, rows: 2, layers: 2 });
    const yellow = parts.find((item) => item.tone === "jerrycan");
    expect(yellow).toBeDefined();
    // 12 cans, each a box of 12 triangles.
    expect(yellow!.geometry.getAttribute("position").count / 3).toBe(12 * 12);
    const box = boundsOf(parts);
    expect(box.max.y).toBeGreaterThan(0.55);
  });

  it("builds a water tank whose tank sits above its stand", () => {
    const parts = waterTankParts({ height: 5, tankRadius: 0.8 });
    const box = boundsOf(parts);
    expect(box.max.y).toBeGreaterThanOrEqual(5 - 0.01);
    expect(box.max.x - box.min.x).toBeGreaterThan(1.6);
    expect(parts.map((item) => item.tone)).toEqual(expect.arrayContaining(["metal", "slate"]));
  });

  it("builds an open dye vat with an indigo surface", () => {
    const parts = dyeVatParts({ radius: 1, height: 0.8 });
    expect(parts.some((item) => item.tone === "indigo")).toBe(true);
    expect(boundsOf(parts).max.y).toBeCloseTo(0.8, 1);
  });

  it("uses only tones the scene knows how to draw", () => {
    const all = [
      ...palmTreeParts({ height: 5, frondLength: 2 }),
      ...marketUmbrellaParts({ height: 2, radius: 1 }),
      ...jerrycanStackParts({ columns: 2, rows: 2, layers: 1 }),
      ...waterTankParts({ height: 4, tankRadius: 0.6 }),
      ...dyeVatParts({ radius: 1, height: 0.8 }),
    ];
    for (const item of all) {
      expect(Object.keys(WORLD_PALETTE)).toContain(item.tone);
    }
  });

  it("merges parts that share a tone into one geometry per tone", () => {
    const merged = mergeParts([
      { tone: "metal", geometry: palmTreeParts({ height: 3, frondLength: 1 })[0]!.geometry },
      { tone: "metal", geometry: palmTreeParts({ height: 3, frondLength: 1 })[0]!.geometry },
    ]);
    expect(merged.filter((item) => item.tone === "metal")).toHaveLength(1);
  });
});
