import { describe, expect, it } from "vitest";
import {
  verifyCommuteShift,
  type CommuteShiftRow,
} from "../../multiplayer/commute-verification.ts";

const expected = { characterId: "char-1", locationId: "loc-1" };
const active: CommuteShiftRow = {
  id: "shift-1",
  character_id: "char-1",
  location_id: "loc-1",
  status: "active",
};

describe("verifyCommuteShift", () => {
  it("accepts an active shift for this character in this neighbourhood", () => {
    expect(verifyCommuteShift(active, expected)).toEqual({ ok: true });
  });

  it("refuses a missing shift", () => {
    expect(verifyCommuteShift(null, expected).ok).toBe(false);
  });

  it("refuses another character's shift with the same message as a missing one", () => {
    const other = verifyCommuteShift({ ...active, character_id: "char-2" }, expected);
    const missing = verifyCommuteShift(null, expected);
    expect(other).toEqual(missing);
  });

  it("refuses a completed or cancelled shift", () => {
    expect(verifyCommuteShift({ ...active, status: "completed" }, expected)).toEqual({
      ok: false,
      reason: "This shift is no longer active.",
    });
    expect(verifyCommuteShift({ ...active, status: "cancelled" }, expected).ok).toBe(false);
  });

  it("refuses a shift that belongs to a different neighbourhood", () => {
    expect(verifyCommuteShift({ ...active, location_id: "loc-2" }, expected)).toEqual({
      ok: false,
      reason: "Your shift is in a different neighbourhood.",
    });
  });
});
