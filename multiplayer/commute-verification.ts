/** A career_shifts row as the server reads it for a commute request. */
export type CommuteShiftRow = {
  id: string;
  character_id: string;
  location_id: string;
  status: string;
};

export type CommuteVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Decides whether a shift may start a commute. Pure, so the room can call it with the row it read
 * through the service-role client and tests can call it directly.
 */
export function verifyCommuteShift(
  shift: CommuteShiftRow | null,
  expected: { characterId: string; locationId: string },
): CommuteVerdict {
  // The same message covers a missing shift and another character's shift, so ids cannot be probed.
  if (!shift || shift.character_id !== expected.characterId) {
    return { ok: false, reason: "That shift could not be found." };
  }
  if (shift.status !== "active") {
    return { ok: false, reason: "This shift is no longer active." };
  }
  if (shift.location_id !== expected.locationId) {
    return { ok: false, reason: "Your shift is in a different neighbourhood." };
  }
  return { ok: true };
}
