import { describe, expect, it } from "vitest";
import {
  advanceCommute,
  COMMUTE_STALL_TICKS,
  commuteArrived,
  createCommutePlan,
} from "../game/commute-route.ts";
import { stepAuthoritativePosition } from "../game/authoritative-movement.ts";
import { toScene, type NeighborhoodObstacle, type WorldPoint } from "../game/neighborhood-model.ts";

const origin: WorldPoint = { x: 7, y: 6 };
const workplace = toScene({ x: 14, y: 9 }, origin);
const context = { origin, objects: [], obstacles: [] as NeighborhoodObstacle[] };

describe("commute controller", () => {
  it("walks a character to the workplace, one server tick at a time", () => {
    const start = { x: 4, y: 4 };
    const plan = createCommutePlan(start, workplace, context);
    expect(plan).not.toBeNull();
    let position = start;
    let status = "moving";
    for (let tick = 0; tick < 3000 && status === "moving"; tick += 1) {
      const result = advanceCommute(plan!, position, context);
      status = result.status;
      if (result.status === "moving") {
        position = stepAuthoritativePosition(position, result.intent, 0.05, origin, [], []);
      }
    }
    expect(status).toBe("arrived");
    expect(commuteArrived(position, origin, workplace)).toBe(true);
  });

  it("walks around a wall between the character and the workplace", () => {
    const wall: NeighborhoodObstacle = {
      id: "wall",
      kind: "compound",
      x: toScene({ x: 9, y: 9 }, origin).x,
      y: toScene({ x: 9, y: 9 }, origin).y,
      width: 40,
      height: 900,
    };
    const ctx = { origin, objects: [], obstacles: [wall] };
    const start = { x: 4, y: 9 };
    const plan = createCommutePlan(start, workplace, ctx);
    expect(plan).not.toBeNull();
    let position = start;
    let status = "moving";
    for (let tick = 0; tick < 4000 && status === "moving"; tick += 1) {
      const result = advanceCommute(plan!, position, ctx);
      status = result.status;
      if (result.status === "moving") {
        position = stepAuthoritativePosition(position, result.intent, 0.05, origin, [], [wall]);
      }
    }
    expect(status).toBe("arrived");
  });

  it("reports arrival immediately when already at work", () => {
    const at = { x: 14, y: 9 };
    const plan = createCommutePlan(at, toScene(at, origin), context);
    expect(advanceCommute(plan!, at, context)).toEqual({ status: "arrived" });
  });

  it("gives up as blocked when the character never moves", () => {
    const start = { x: 4, y: 4 };
    const plan = createCommutePlan(start, workplace, context);
    let result = advanceCommute(plan!, start, context);
    let ticks = 1;
    // Standing still counts as a stall; after the replan budget is spent the commute is blocked.
    while (result.status === "moving" && ticks < 10_000) {
      result = advanceCommute(plan!, start, context);
      ticks += 1;
    }
    expect(result.status).toBe("blocked");
    expect(ticks).toBeGreaterThanOrEqual(COMMUTE_STALL_TICKS * 4);
  });
});
