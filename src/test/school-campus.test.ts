import { it, expect } from "vitest";
import { CAMPUS_AREAS, CAMPUS_BUILDINGS, CAMPUS_PATHS, campusArea } from "@/game/school-campus";
import { getLocationVenueDesign, hasLocationVenueDesign } from "@/lib/location-venue-designs";
it("has a path to each teaching block entrance and the campus gate", () => {
  const onPath = (x: number, z: number) =>
    CAMPUS_PATHS.some((p) => Math.abs(x - p.x) <= p.width / 2 && Math.abs(z - p.z) <= p.depth / 2);
  expect(onPath(0, 13)).toBe(true);
  for (const building of CAMPUS_BUILDINGS)
    expect(onPath(building.x, building.z + building.depth / 2)).toBe(true);
});
it("registers the actual student destination and keeps its areas distinct", () => {
  expect(hasLocationVenueDesign("student-district")).toBe(true);
  expect(new Set(CAMPUS_AREAS.map((a) => a.id)).size).toBe(4);
  for (const area of CAMPUS_AREAS) expect(campusArea(area.id)).toBe(area);
  expect(getLocationVenueDesign("student-district", "Campus").fixtures).toHaveLength(3);
});
