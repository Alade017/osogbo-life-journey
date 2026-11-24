import { expect, it } from "vitest";
import { createBankNavigation } from "@/game/bank-lobby-navigation";

it("routes around furniture with body clearance instead of crossing it", () => {
  const nav = createBankNavigation([
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  ]);
  expect(nav.canWalk([0, 0])).toBe(false);
  expect(nav.canWalk([1.1, 0])).toBe(false);
  const route = nav.route([-2, 0], [2, 0]);
  expect(route).not.toBeNull();
  expect(route!.some(([, z]) => Math.abs(z) >= 1.5)).toBe(true);
  for (let i = 1; i < route!.length; i++) {
    const a = route![i - 1]!,
      b = route![i]!;
    for (let t = 0; t <= 1; t += 0.05)
      expect(nav.canWalk([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])).toBe(true);
  }
});
it("rejects blocked, unreachable and out-of-bounds destinations without direct fallback", () => {
  const nav = createBankNavigation([
    [
      [0, -4],
      [0, 4],
    ],
  ]);
  expect(nav.route([-2, 0], [2, 0])).toBeNull();
  expect(nav.route([-2, 0], [0, 0])).toBeNull();
  expect(nav.route([-2, 0], [5.6, 0])).toBeNull();
  expect(nav.route([-2, 0], [NaN, 0])).toBeNull();
  expect(nav.nearest([0, 0])).not.toBeNull();
  expect(nav.canWalk(nav.nearest([0, 0])!)).toBe(true);
});

it("keeps relocated people apart and leaves room for the entrance", () => {
  const nav = createBankNavigation([]);
  const occupied: Array<readonly [number, number]> = [[1.5, 3]];
  for (let i = 0; i < 9; i++) {
    const point = nav.nearest([1.5, 3], occupied)!;
    expect(point).not.toBeNull();
    expect(
      occupied.every((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) >= 0.55),
    ).toBe(true);
    occupied.push(point);
  }
});
