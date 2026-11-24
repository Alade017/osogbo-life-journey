import { expect, it } from "vitest";
import { findDoorPath, type RoomPoint } from "@/game/house-navigation";

for (const axis of ["x", "z"] as const) {
  for (const side of [-1, 1]) {
    it(`crosses a ${axis}-aligned doorway from side ${side}`, () => {
      const start: RoomPoint = axis === "x" ? [0, 0, side * 2] : [side * 2, 0, 0];
      const path = findDoorPath({ id: "test", axis, x: 0, z: 0, width: 1.1 }, start, 6, 6, []);
      expect((path?.at(-1)?.[axis === "x" ? 2 : 0] ?? 0) * side).toBeLessThan(-0.4);
    });
  }
}
it("rejects a doorway obstructed by furniture", () => {
  expect(
    findDoorPath({ id: "test", axis: "x", x: 0, z: 0, width: 1.1 }, [0, 0, 2], 6, 6, [
      { x: 0, z: 0, w: 2, d: 1 },
    ]),
  ).toBeNull();
});
