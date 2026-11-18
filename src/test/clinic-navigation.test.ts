import { expect, it } from "vitest";
import {
  clinicPath,
  canWalkClinic,
  CLINIC_SPAWN,
  CLINIC_ROOM_APPROACH,
} from "@/game/clinic-navigation";
it("connects the entrance to every visitor room through actual door openings", () => {
  for (const to of Object.values(CLINIC_ROOM_APPROACH)) {
    const path = clinicPath(CLINIC_SPAWN, to);
    expect(path, `route to ${to}`).not.toBeNull();
    for (let i = 1; i < path!.length; i++)
      for (let t = 0; t <= 1; t += 0.1)
        expect(
          canWalkClinic([
            path![i - 1]![0] * (1 - t) + path![i]![0] * t,
            path![i - 1]![1] * (1 - t) + path![i]![1] * t,
          ]),
        ).toBe(true);
  }
});
it("blocks furniture, walls, staff rooms, supplies, and invalid coordinates", () => {
  for (const point of [
    [3, 3],
    [9, 3],
    [16, 3],
    [6, 2],
    [-1, 2],
    [NaN, 2],
  ] as const)
    expect(canWalkClinic(point)).toBe(false);
  expect(clinicPath(CLINIC_SPAWN, [9, 3])).toBeNull();
  expect(clinicPath(CLINIC_SPAWN, [3, 3])).toBeNull();
  expect(canWalkClinic([3, 6])).toBe(true);
  expect(canWalkClinic([5, 6])).toBe(false);
});
