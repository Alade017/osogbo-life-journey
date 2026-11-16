import { expect, it } from "vitest";
import { mapFocusTarget } from "@/components/map/map-focus";
import { MapPointerGesture } from "@/components/map/map-pointer-gesture";
const frame = { left: -50, right: 50, top: 30, bottom: -30, zoom: 2 };
it("offsets focus away from a right panel and expanded bottom sheet at the current zoom", () => {
  expect(
    mapFocusTarget([10, 0, 5], { right: 400, bottom: 0 }, { width: 1000, height: 600 }, frame),
  ).toEqual([20, 0, 5]);
  const target = mapFocusTarget(
    [10, 0, 5],
    { right: 0, bottom: 300 },
    { width: 1000, height: 600 },
    frame,
  );
  expect(target[0]).toBe(10);
  expect(target[2]).toBeGreaterThan(5);
  expect(
    mapFocusTarget([10, 0, 5], { right: 0, bottom: 0 }, { width: 1000, height: 600 }, frame),
  ).toEqual([10, 0, 5]);
});
it("rejects a drag even when the pointer returns to its origin", () => {
  const g = new MapPointerGesture();
  g.down(1, 0, 0);
  g.move(10, 0);
  g.move(0, 0);
  g.up(1);
  expect(g.moved).toBe(true);
  g.down(2, 0, 0);
  g.move(2, 2);
  g.up(2);
  expect(g.moved).toBe(false);
});
it("rejects pinch and cancellation, and allows keyboard activation after a drag", () => {
  const g = new MapPointerGesture();
  g.down(1, 0, 0);
  g.down(2, 0, 0);
  g.up(2);
  g.up(1);
  expect(g.moved).toBe(true);
  g.keyboard();
  expect(g.moved).toBe(false);
  g.down(3, 0, 0);
  g.cancel(3);
  expect(g.moved).toBe(true);
});
