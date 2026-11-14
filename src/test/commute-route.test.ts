import { describe, expect, it } from "vitest";
import {
  COMMUTE_ARRIVAL_PX,
  commuteArrived,
  commuteIntent,
  planCommuteRoute,
} from "../game/commute-route.ts";
import { canOccupyNeighborhoodPoint } from "../game/authoritative-movement.ts";
import { toScene, type NeighborhoodObstacle, type WorldPoint } from "../game/neighborhood-model.ts";

const origin: WorldPoint = { x: 7, y: 6 };
const emptyObjects: never[] = [];

function wall(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NeighborhoodObstacle {
  return { id, kind: "compound", x, y, width, height };
}

describe("planCommuteRoute", () => {
  it("returns the start alone when the character is already at work", () => {
    const start = { x: 10, y: 10 };
    const target = toScene(start, origin);
    expect(planCommuteRoute(start, target, origin, emptyObjects, [])).toEqual([start]);
  });

  it("plans a walkable route to the workplace in an open area", () => {
    const start = { x: 4, y: 4 };
    const target = toScene({ x: 12, y: 9 }, origin);
    const route = planCommuteRoute(start, target, origin, emptyObjects, []);
    expect(route).not.toBeNull();
    expect(route![0]).toEqual(start);
    const last = route![route!.length - 1]!;
    expect(commuteArrived(last, origin, target)).toBe(true);
    for (const point of route!) {
      expect(canOccupyNeighborhoodPoint(point, origin, emptyObjects, [])).toBe(true);
    }
  });

  it("detours around a solid wall between the character and the workplace", () => {
    const start = { x: 4, y: 10 };
    const destination = { x: 14, y: 10 };
    const target = toScene(destination, origin);
    // A wall in scene space spanning the whole height of the lane between start and target.
    const sceneStart = toScene(start, origin);
    const sceneMid = { x: (sceneStart.x + target.x) / 2, y: sceneStart.y };
    const obstacles = [wall("divider", sceneMid.x, sceneMid.y, 40, 800)];
    const route = planCommuteRoute(start, target, origin, emptyObjects, obstacles);
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(2);
    for (const point of route!) {
      expect(canOccupyNeighborhoodPoint(point, origin, emptyObjects, obstacles)).toBe(true);
    }
  });

  it("returns null when the workplace is sealed off", () => {
    const start = { x: 4, y: 4 };
    const target = toScene({ x: 14, y: 10 }, origin);
    const obstacles = [wall("sealing", target.x, target.y, 600, 600)];
    expect(planCommuteRoute(start, target, origin, emptyObjects, obstacles)).toBeNull();
  });

  it("returns null when the start position is not walkable", () => {
    const start = { x: 4, y: 4 };
    const startScene = toScene(start, origin);
    const obstacles = [wall("on-top", startScene.x, startScene.y, 60, 60)];
    const target = toScene({ x: 14, y: 10 }, origin);
    expect(planCommuteRoute(start, target, origin, emptyObjects, obstacles)).toBeNull();
  });
});

describe("commuteIntent", () => {
  it("steers along one axis toward the next waypoint and advances when reached", () => {
    const route = [
      { x: 1, y: 1 },
      { x: 1.5, y: 1 },
      { x: 1.5, y: 2 },
    ];
    expect(commuteIntent({ x: 1, y: 1 }, route, 0)).toEqual({ intent: { x: 1, y: 0 }, index: 1 });
    expect(commuteIntent({ x: 1.5, y: 1 }, route, 1)).toEqual({ intent: { x: 0, y: 1 }, index: 2 });
    expect(commuteIntent({ x: 1.5, y: 2 }, route, 2)).toEqual({ intent: null, index: 3 });
  });

  it("signals arrival when there is no remaining waypoint", () => {
    expect(commuteIntent({ x: 0, y: 0 }, [], 0)).toEqual({ intent: null, index: 0 });
  });

  it("keeps the arrival radius in scene pixels", () => {
    const target = toScene({ x: 10, y: 10 }, origin);
    const near = { x: 10 + (COMMUTE_ARRIVAL_PX - 1) / 160, y: 10 };
    const far = { x: 10 + (COMMUTE_ARRIVAL_PX + 20) / 160, y: 10 };
    expect(commuteArrived(near, origin, target)).toBe(true);
    expect(commuteArrived(far, origin, target)).toBe(false);
  });
});
