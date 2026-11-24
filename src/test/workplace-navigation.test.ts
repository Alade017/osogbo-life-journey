import { describe, it, expect } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { workplaceNavigation, workplaceSpawn } from "@/game/workplace-navigation";

const fixtures = getLocationVenueDesign("harvest-tech-hub", "Harvest Tech Hub").fixtures;
const nav = workplaceNavigation(fixtures);
describe("Harvest Tech Hub routes", () => {
  it.each(fixtures)("reaches $label from the entrance and every other station", (target) => {
    for (const start of [
      workplaceSpawn,
      ...fixtures.map((f) => nav.approach(workplaceSpawn, f)!.at(-1)!),
    ]) {
      const path = nav.approach(start, target);
      expect(path).toBeTruthy();
      expect(path!.every(nav.canWalk)).toBe(true);
    }
  });
  it("blocks fixtures, partitions, planters, the open door and outside the room", () => {
    for (const p of [
      ...fixtures.map((f) => f.position),
      [-4, 2.8],
      [1.1, 1.6],
      [-6.3, 4.9],
      [-1.1, 5],
      [8, 0],
    ] as [number, number][])
      expect(nav.route(workplaceSpawn, p)).toBeNull();
  });
});

it("reaches a clear tap near a partition even if rounding puts it inside the collision margin", () => {
  const target = [-6, 2.3] as const;
  expect(nav.canWalk(target)).toBe(true);
  expect(nav.route(workplaceSpawn, target)?.at(-1)).toEqual(target);
});
