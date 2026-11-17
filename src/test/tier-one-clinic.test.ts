import { expect, it } from "vitest";
import {
  CLINIC_ROOMS,
  CLINIC_CORRIDORS,
  CLINIC_PARKING,
  clinicRoomAt,
} from "@/game/tier-one-clinic";
it("keeps rooms out of the four-tile primary corridor and entrance spine", () => {
  for (const room of CLINIC_ROOMS)
    for (const c of CLINIC_CORRIDORS)
      expect(
        room.x + room.width <= c.x ||
          room.x >= c.x + c.width ||
          room.z + room.depth <= c.z ||
          room.z >= c.z + c.depth,
      ).toBe(true);
  expect(CLINIC_CORRIDORS.every((c) => Math.min(c.width, c.depth) >= 4)).toBe(true);
});
it("has six independent parking bays and doors within room boundaries", () => {
  expect(CLINIC_PARKING).toHaveLength(6);
  for (const room of CLINIC_ROOMS) {
    expect(room.doorX - 0.8).toBeGreaterThanOrEqual(room.x);
    expect(room.doorX + 0.8).toBeLessThanOrEqual(room.x + room.width);
  }
  expect(clinicRoomAt(3, 3)?.id).toBe("exam");
  expect(clinicRoomAt(12, 8)).toBeUndefined();
});
