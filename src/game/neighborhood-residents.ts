import {
  neighborhoodBuildingFootprint,
  neighborhoodObstacleFootprint,
  type GroundRect,
} from "@/game/neighborhood-geometry";
import { neighborhoodNpcDestinationPoint, type NpcPoint } from "@/game/neighborhood-npc-layout";
import type { NeighborhoodArea } from "@/game/neighborhood-model";

/**
 * Ambient residents: background people who live in a neighbourhood and walk its streets all day.
 * They are visual only (no database rows, no interactions), so the streets feel lived in
 * even when no story NPC is out. Everything is deterministic per district, so the same
 * neighbourhood always has the same residents on the same routes.
 */
export const AMBIENT_RESIDENT_COUNT = 8;

const RESIDENT_NAMES = [
  "Adebayo",
  "Funke",
  "Tunde",
  "Ife",
  "Bola",
  "Kemi",
  "Sade",
  "Yemi",
  "Ola",
  "Femi",
  "Dayo",
  "Wale",
  "Ronke",
  "Lekan",
  "Titi",
  "Segun",
] as const;

export type AmbientResident = { id: string; name: string; index: number; start: NpcPoint };

export type AmbientPlan = {
  bounds: GroundRect;
  stops: readonly NpcPoint[];
  occupied: readonly GroundRect[];
};

/** Deterministic value in [0, 1) from a text seed and a number. */
function unit(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % 100000) / 100000;
}

/** The walkable rectangle of the district: its environment, inset so people stay off the edge. */
function walkableBounds(area: NeighborhoodArea): GroundRect {
  const env = area.environment;
  if (!env) throw new Error(`${area.slug} needs an environment for ambient residents`);
  const inset = 40;
  return {
    left: env.x - env.width / 2 + inset,
    top: env.y - env.height / 2 + inset,
    width: env.width - inset * 2,
    height: env.height - inset * 2,
  };
}

/** Things a resident can head for: homes, work, market, benches, landmarks and road sections. */
function stopsFor(area: NeighborhoodArea, bounds: GroundRect): NpcPoint[] {
  const stops: NpcPoint[] = [];
  for (const object of area.objects) {
    if (object.kind !== "npc") stops.push({ x: object.x, y: object.y });
  }
  for (const obstacle of area.obstacles ?? []) {
    if (obstacle.kind === "bench" || obstacle.kind === "kiosk" || obstacle.kind === "landmark") {
      stops.push({ x: obstacle.x, y: obstacle.y });
    }
  }
  for (const road of area.roads ?? []) {
    for (const fraction of [0.2, 0.5, 0.8]) {
      stops.push(
        road.axis === "vertical"
          ? { x: road.offset, y: bounds.top + bounds.height * fraction }
          : { x: bounds.left + bounds.width * fraction, y: road.offset },
      );
    }
  }
  return stops;
}

/** Solid things residents must walk around: buildings, compounds and street furniture. */
function occupiedFor(area: NeighborhoodArea): GroundRect[] {
  return [
    ...area.objects
      .filter((object) => object.kind !== "npc" && !object.walkIn)
      .map(neighborhoodBuildingFootprint),
    ...(area.obstacles ?? []).map(neighborhoodObstacleFootprint),
  ];
}

export function buildAmbientPlan(area: NeighborhoodArea): AmbientPlan {
  const bounds = walkableBounds(area);
  return { bounds, stops: stopsFor(area, bounds), occupied: occupiedFor(area) };
}

function pickStop(plan: AmbientPlan, seed: string, n: number): NpcPoint {
  const stop = plan.stops[Math.floor(unit(seed, n) * plan.stops.length) % plan.stops.length];
  if (!stop) throw new Error("ambient plan has no stops");
  return stop;
}

/**
 * The residents for a district. Each starts on clear ground, away from buildings and
 * from the residents placed before it, so nobody spawns inside a wall or on top of someone.
 */
export function ambientResidentRoster(
  area: NeighborhoodArea,
  plan: AmbientPlan = buildAmbientPlan(area),
  count = AMBIENT_RESIDENT_COUNT,
): AmbientResident[] {
  const residents: AmbientResident[] = [];
  const placed: NpcPoint[] = [];
  const nameOffset = Math.floor(unit(area.slug, 97) * RESIDENT_NAMES.length);
  for (let index = 0; index < count; index += 1) {
    let start: NpcPoint | null = null;
    for (let attempt = 0; attempt < 12 && !start; attempt += 1) {
      const anchor = pickStop(plan, area.slug, index * 12 + attempt);
      start = neighborhoodNpcDestinationPoint(
        anchor,
        index * 12 + attempt,
        [...plan.occupied],
        placed,
        plan.bounds,
      );
    }
    if (!start) continue;
    placed.push(start);
    residents.push({
      id: `${area.slug}-resident-${index}`,
      name: RESIDENT_NAMES[(index + nameOffset) % RESIDENT_NAMES.length]!,
      index,
      start,
    });
  }
  return residents;
}

/** How long a resident pauses at a stop before walking on, in milliseconds. */
export function ambientPauseMs(index: number, step: number): number {
  return 2500 + unit(`pause-${index}`, step) * 6000;
}

/**
 * The next place a resident walks to. Tries a few stops so the answer is
 * always a clear point that differs from where they stand now.
 */
export function nextAmbientTarget(
  plan: AmbientPlan,
  index: number,
  step: number,
  current: NpcPoint,
): NpcPoint {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const anchor = pickStop(plan, `walk-${index}`, step * 6 + attempt);
    const target = neighborhoodNpcDestinationPoint(
      anchor,
      index * 7 + step + attempt,
      [...plan.occupied],
      [],
      plan.bounds,
    );
    if (target && Math.hypot(target.x - current.x, target.y - current.y) > 30) return target;
  }
  return current;
}
