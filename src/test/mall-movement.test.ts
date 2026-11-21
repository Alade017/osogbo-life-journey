import { describe, expect, it } from "vitest";
import {
  MALL_MOVE_BURST,
  MALL_WALK_SPEED,
  checkMallMove,
  createWalker,
  isSegmentWalkable,
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
    walker = stepWalker(walker, 1);
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

describe("mall move checks", () => {
  it("accepts a short walk along open floor", () => {
    const result = checkMallMove(MALL_MOVE_BURST, MALL_ENTRANCE, [0, 5.5], 0.2);
    expect(result.ok).toBe(true);
  });

  it("refuses a move into a restricted room, however short", () => {
    expect(checkMallMove(MALL_MOVE_BURST, [6.5, -4], [7, -5.5], 10)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("refuses a route that crosses shelves even when both ends are open", () => {
    // Shelves sit between z -4.93 and -4.07 at x 2.2..5.8: the straight line crosses them.
    expect(isSegmentWalkable([3, -5.5], [3, -3])).toBe(false);
    expect(checkMallMove(MALL_MOVE_BURST, [3, -5.5], [3, -3], 10)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("refuses a jump longer than the burst limit, however long the pause", () => {
    const longPause = checkMallMove(0, [-6, 2], [-3, 2], 600);
    expect(longPause).toEqual({ ok: false, reason: "speed" });
  });

  it("spends allowance on each move and refills it over time", () => {
    const first = checkMallMove(MALL_MOVE_BURST, [-6, 2], [-5.5, 2], 0.2);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.allowance).toBeCloseTo(MALL_MOVE_BURST - 0.5);
    const refilled = checkMallMove(0, [-6, 2], [-5.5, 2], 1);
    expect(refilled.ok).toBe(true);
  });

  it("caps the allowance at the burst limit", () => {
    const result = checkMallMove(0, [-6, 2], [-6, 2], 600);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.allowance).toBeLessThanOrEqual(MALL_MOVE_BURST);
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
