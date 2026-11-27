// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ATIKU_AREA,
  CITY_CENTRE_AREA,
  OKE_FIA_AREA,
  type NeighborhoodArea,
} from "@/game/neighborhood-model";
import {
  AMBIENT_RESIDENT_COUNT,
  ambientPauseMs,
  ambientResidentRoster,
  buildAmbientPlan,
  nextAmbientTarget,
} from "@/game/neighborhood-residents";
import type { GroundRect } from "@/game/neighborhood-geometry";

const AREAS: readonly NeighborhoodArea[] = [CITY_CENTRE_AREA, ATIKU_AREA, OKE_FIA_AREA];

function insideRect(point: { x: number; y: number }, rect: GroundRect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function clearOfBuildings(point: { x: number; y: number }, occupied: readonly GroundRect[]) {
  return !occupied.some((rect) => insideRect(point, rect));
}

describe("ambient residents", () => {
  it.each(AREAS.map((area) => [area.slug, area] as const))(
    "%s has a full roster of residents",
    (_slug, area) => {
      const roster = ambientResidentRoster(area);
      expect(roster).toHaveLength(AMBIENT_RESIDENT_COUNT);
      expect(new Set(roster.map((resident) => resident.id)).size).toBe(AMBIENT_RESIDENT_COUNT);
    },
  );

  it.each(AREAS.map((area) => [area.slug, area] as const))(
    "%s residents start on clear ground inside the district",
    (_slug, area) => {
      const plan = buildAmbientPlan(area);
      for (const resident of ambientResidentRoster(area, plan)) {
        expect(insideRect(resident.start, plan.bounds)).toBe(true);
        expect(clearOfBuildings(resident.start, plan.occupied)).toBe(true);
      }
    },
  );

  it.each(AREAS.map((area) => [area.slug, area] as const))(
    "%s residents do not start on top of each other",
    (_slug, area) => {
      const starts = ambientResidentRoster(area).map((resident) => resident.start);
      for (let i = 0; i < starts.length; i += 1) {
        for (let j = i + 1; j < starts.length; j += 1) {
          const a = starts[i]!;
          const b = starts[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
        }
      }
    },
  );

  it.each(AREAS.map((area) => [area.slug, area] as const))(
    "%s rosters are the same every time",
    (_slug, area) => {
      expect(ambientResidentRoster(area)).toEqual(ambientResidentRoster(area));
    },
  );

  it.each(AREAS.map((area) => [area.slug, area] as const))(
    "%s residents keep walking to clear, different places",
    (_slug, area) => {
      const plan = buildAmbientPlan(area);
      for (const resident of ambientResidentRoster(area, plan)) {
        let here = resident.start;
        for (let step = 1; step <= 4; step += 1) {
          const next = nextAmbientTarget(plan, resident.index, step, here);
          expect(insideRect(next, plan.bounds)).toBe(true);
          expect(clearOfBuildings(next, plan.occupied)).toBe(true);
          expect(Math.hypot(next.x - here.x, next.y - here.y)).toBeGreaterThan(30);
          here = next;
        }
      }
    },
  );

  it("pauses between walks for a few seconds, not forever or instantly", () => {
    for (let step = 0; step < 10; step += 1) {
      const pause = ambientPauseMs(3, step);
      expect(pause).toBeGreaterThanOrEqual(2500);
      expect(pause).toBeLessThan(8500);
    }
  });
});
