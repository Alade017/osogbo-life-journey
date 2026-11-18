import { describe, expect, it } from "vitest";
import {
  MALL_WALK_SPEED,
  createWalker,
  isPossibleMallMove,
  stepWalker,
} from "@/game/mall-movement";
import {
  MALL_BROWSE_SPOTS,
  MALL_ENTRANCE,
  MALL_STAFF,
  MALL_TILL_QUEUE,
  canWalkInMall,
  findMallPath,
} from "@/game/osun-mall-layout";

describe("mall walkers", () => {
  it("moves at walking speed toward the next waypoint", () => {
    const walker = createWalker([0, 0], [[10, 0]]);
    const next = stepWalker(walker, 1);
    expect(next.pos[0]).toBeCloseTo(MALL_WALK_SPEED);
    expect(next.moving).toBe(true);
    expect(next.done).toBe(false);
  });

  it("finishes at the last waypoint and stops moving", () => {
    let walker = createWalker([0, 0], [[1, 0]]);
    for (let i = 0; i < 20 && !walker.done; i += 1) walker = stepWalker(walker, 0.1);
    expect(walker.done).toBe(true);
    expect(walker.pos).toEqual([1, 0]);
    expect(walker.moving).toBe(false);
  });

  it("pauses at a dwell waypoint before moving on", () => {
    let walker = createWalker(
      [0, 0],
      [
        [0.5, 0],
        [2, 0],
      ],
      { dwellAt: new Map([[0, 2]]) },
    );
    walker = stepWalker(walker, 1); // reaches the first point
    expect(walker.moving).toBe(false);
    expect(walker.dwellLeft).toBe(2);
    walker = stepWalker(walker, 1);
    expect(walker.dwellLeft).toBe(1);
    expect(walker.pos).toEqual([0.5, 0]);
  });

  it("does not mutate the walker it was given", () => {
    const walker = createWalker([0, 0], [[10, 0]]);
    stepWalker(walker, 1);
    expect(walker.pos).toEqual([0, 0]);
  });
});

describe("mall move validation", () => {
  it("accepts a short walk to a walkable point", () => {
    expect(isPossibleMallMove(MALL_ENTRANCE, [0, 5.5], 1)).toBe(true);
  });

  it("rejects a move into a restricted room, however short", () => {
    expect(isPossibleMallMove([6.5, -4], [7, -5.5], 10)).toBe(false);
  });

  it("rejects a jump farther than walking speed allows in the time since the last update", () => {
    expect(isPossibleMallMove([-6, 2], [6, 2], 0.5)).toBe(false);
    expect(canWalkInMall([6, 2])).toBe(true);
    expect(isPossibleMallMove([-6, 2], [6, 2], 10)).toBe(true);
  });
});

describe("mall spots", () => {
  it("keeps every browse spot, queue spot and the entrance walkable", () => {
    for (const point of [...MALL_BROWSE_SPOTS, ...MALL_TILL_QUEUE, MALL_ENTRANCE]) {
      expect(canWalkInMall(point), JSON.stringify(point)).toBe(true);
    }
  });

  it("can route from the entrance to every browse spot and every queue spot", () => {
    for (const point of [...MALL_BROWSE_SPOTS, ...MALL_TILL_QUEUE]) {
      expect(findMallPath(MALL_ENTRANCE, point), JSON.stringify(point)).not.toBeNull();
    }
  });

  it("places fourteen staff, three of them in the restricted rooms", () => {
    expect(MALL_STAFF).toHaveLength(14);
    expect(
      MALL_STAFF.filter((member) => member.role === "staff-room" || member.role === "control-room"),
    ).toHaveLength(3);
  });
});
