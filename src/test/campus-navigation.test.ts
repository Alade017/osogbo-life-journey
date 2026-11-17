import { expect, it } from "vitest";
import { CAMPUS_BUILDINGS, type CampusAreaId } from "@/game/school-campus";
import {
  CAMPUS_ENTRY,
  CAMPUS_ROOM_ENTRY,
  CAMPUS_INTERIOR_TARGETS,
  campusEntrance,
  campusWalkPath,
  canWalkCampus,
  campusSolids,
} from "@/game/campus-navigation";
function validPath(area: CampusAreaId, path: ReturnType<typeof campusWalkPath>) {
  expect(path).not.toBeNull();
  for (let i = 1; i < path!.length; i++)
    for (let t = 0; t <= 1; t += 0.1)
      expect(
        canWalkCampus(area, [
          path![i - 1][0] * (1 - t) + path![i][0] * t,
          path![i - 1][1] * (1 - t) + path![i][1] * t,
        ]),
      ).toBe(true);
}
it("reaches every building entrance while staying on campus paths", () => {
  for (const building of CAMPUS_BUILDINGS)
    validPath("courtyard", campusWalkPath("courtyard", CAMPUS_ENTRY, campusEntrance(building.id)));
  for (const a of CAMPUS_BUILDINGS)
    for (const b of CAMPUS_BUILDINGS)
      validPath(
        "courtyard",
        campusWalkPath("courtyard", campusEntrance(a.id), campusEntrance(b.id)),
      );
});
it("reaches each room focus and returns to the doorway around furniture", () => {
  for (const [id, to] of Object.entries(CAMPUS_INTERIOR_TARGETS)) {
    const area = id as Exclude<CampusAreaId, "courtyard">;
    validPath(area, campusWalkPath(area, CAMPUS_ROOM_ENTRY, to));
    validPath(area, campusWalkPath(area, to, CAMPUS_ROOM_ENTRY));
  }
});
it("rejects grass, building footprints, furniture and out-of-bounds clicks", () => {
  expect(canWalkCampus("courtyard", [8, 6])).toBe(false);
  for (const b of CAMPUS_BUILDINGS) expect(canWalkCampus("courtyard", [b.x, b.z])).toBe(false);
  for (const area of ["classroom", "library", "administration"] as const)
    for (const s of campusSolids(area)) expect(canWalkCampus(area, [s.x, s.z])).toBe(false);
  expect(campusWalkPath("courtyard", CAMPUS_ENTRY, [NaN, 0])).toBeNull();
  expect(campusWalkPath("classroom", CAMPUS_ROOM_ENTRY, [0, 20])).toBeNull();
});
