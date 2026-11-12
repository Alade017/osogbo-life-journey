import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { garmentShell } from "@/components/3d/character-garments";

/** Two triangles: one low on the body (y 0.1) and one high (y 0.8), both facing +z. */
function body() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0.1, 0, 1, 0.1, 0, 0, 0.12, 1, 0, 0.8, 0, 1, 0.8, 0, 0, 0.82, 1],
      3,
    ),
  );
  geometry.setAttribute(
    "normal",
    new Float32BufferAttribute(
      new Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)),
      3,
    ),
  );
  return geometry;
}

describe("garmentShell", () => {
  it("keeps only triangles whose centre is inside the band", () => {
    const shell = garmentShell(body(), { min: 0.5, max: 1, inflate: 0.01 });
    expect(shell.getAttribute("position").count).toBe(3);
  });

  it("pushes each kept vertex outward along its normal", () => {
    const shell = garmentShell(body(), { min: 0.5, max: 1, inflate: 0.01 });
    expect(shell.getAttribute("position").getZ(0)).toBeCloseTo(0.01, 6);
    expect(shell.getAttribute("position").getY(0)).toBeCloseTo(0.8, 6);
  });

  it("returns an empty shell when the band misses the body", () => {
    const shell = garmentShell(body(), { min: 2, max: 3, inflate: 0.01 });
    expect(shell.getAttribute("position").count).toBe(0);
  });
});
