import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { buildBodyGeometry } from "@/components/3d/character-body-geometry";

/** A unit-tall figure: a head and feet on the centre line, a hip on each side, and a T-pose arm on each side. */
function figure(points: number[][]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  return geometry;
}

function expectVertex(actual: number[], expected: number[]) {
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis]!, 5));
}

function vertex(geometry: BufferGeometry, index: number) {
  const position = geometry.getAttribute("position");
  return [position.getX(index), position.getY(index), position.getZ(index)];
}

describe("buildBodyGeometry", () => {
  const points = [
    [0, 0, 0],
    [0, 1, 0],
    [0.2, 0.5, 0],
    [-0.2, 0.5, 0],
    [0.118, 0.8, 0],
    [0.3, 0.6, 0],
    [-0.3, 0.6, 0],
  ];
  const built = buildBodyGeometry(figure(points));
  const bounds = built.boundingBox!;

  it("stands the body on the origin, one unit tall, centred on x and z", () => {
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(1);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(0);
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(0);
  });

  it("swings the T-pose arm down toward the side", () => {
    const tip = vertex(built, 5);
    expect(tip[0]).toBeLessThan(0.25);
    expect(tip[1]).toBeLessThan(0.6);
    const mirrored = vertex(built, 6);
    expect(mirrored[0]).toBeGreaterThan(-0.25);
    expect(mirrored[1]).toBeLessThan(0.6);
  });

  it("leaves the hips and the head where they were", () => {
    expectVertex(vertex(built, 2), [0.2, 0.5, 0]);
    expectVertex(vertex(built, 1), [0, 1, 0]);
  });

  it("does not modify the source geometry", () => {
    const source = figure(points);
    buildBodyGeometry(source);
    expectVertex(vertex(source, 5), [0.3, 0.6, 0]);
  });
});
