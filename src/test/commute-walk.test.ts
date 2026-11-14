import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_AREAS, toScene, type NeighborhoodArea } from "../game/neighborhood-model.ts";
import { advanceCommute, createCommutePlan, type CommutePlan } from "../game/commute-route.ts";
import {
  PLAYER_WORLD_BOUNDS,
  canOccupyNeighborhoodPoint,
  stepAuthoritativePosition,
} from "../game/authoritative-movement.ts";

const origin = { x: 7, y: 6 };
const TICK_SECONDS = 0.05;

function farthestFreeStart(area: NeighborhoodArea, work: { x: number; y: number }) {
  let best = null as { x: number; y: number } | null;
  let bestDistance = -1;
  for (let x = PLAYER_WORLD_BOUNDS.minX; x <= PLAYER_WORLD_BOUNDS.maxX; x += 0.5)
    for (let y = PLAYER_WORLD_BOUNDS.minY; y <= PLAYER_WORLD_BOUNDS.maxY; y += 0.5) {
      const point = { x, y };
      if (!canOccupyNeighborhoodPoint(point, origin, area.objects, area.obstacles ?? [])) continue;
      const scene = toScene(point, origin);
      const distance = Math.hypot(scene.x - work.x, scene.y - work.y);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
  return best;
}

/** Walks a commute with the same tick and movement rules the room uses. */
function walk(area: NeighborhoodArea, plan: CommutePlan, start: { x: number; y: number }) {
  const context = { origin, objects: area.objects, obstacles: area.obstacles ?? [] };
  let position = { ...start };
  let blocked = 0;
  const visits = new Map<string, number>();
  for (let tick = 0; tick < 4000; tick += 1) {
    const step = advanceCommute(plan, position, context);
    if (step.status !== "moving")
      return { status: step.status, blocked, maxRevisit: Math.max(0, ...visits.values()) };
    const next = stepAuthoritativePosition(
      position,
      step.intent,
      TICK_SECONDS,
      origin,
      area.objects,
      area.obstacles ?? [],
    );
    if (next.x === position.x && next.y === position.y) blocked += 1;
    position = next;
    const key = `${Math.round(position.x * 8)},${Math.round(position.y * 8)}`;
    visits.set(key, (visits.get(key) ?? 0) + 1);
  }
  return { status: "timeout", blocked, maxRevisit: Math.max(0, ...visits.values()) };
}

describe("commute walks", () => {
  for (const slug of ["city-centre", "oja-oba", "residential", "business-district"]) {
    it(`walks ${slug} to work without stalling or circling`, () => {
      const area = NEIGHBORHOOD_AREAS[slug]!;
      const work = area.objects.find((object) => object.kind === "work")!;
      const start = farthestFreeStart(area, work);
      expect(start).not.toBeNull();
      const plan = createCommutePlan(
        start!,
        { x: work.x, y: work.y },
        {
          origin,
          objects: area.objects,
          obstacles: area.obstacles ?? [],
        },
      );
      expect(plan).not.toBeNull();
      const result = walk(area, plan!, start!);
      expect(result.status).toBe("arrived");
      expect(result.blocked).toBe(0);
      // Corners are turned a few times; a circling walker revisits one square dozens of times.
      expect(result.maxRevisit).toBeLessThan(10);
    });
  }
});
