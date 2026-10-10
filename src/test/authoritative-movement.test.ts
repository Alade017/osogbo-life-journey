import { describe, expect, it } from "vitest";
import {
  canOccupyNeighborhoodPoint,
  parseMovementIntent,
  PLAYER_SPEED,
  stepAuthoritativePosition,
} from "@/game/authoritative-movement";

const origin = { x: 7, y: 6 };

describe("authoritative neighborhood movement", () => {
  it("accepts only bounded cardinal and diagonal movement intents", () => {
    expect(parseMovementIntent({ x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(parseMovementIntent({ x: -1, y: 1 })).toEqual({ x: -1, y: 1 });
    expect(parseMovementIntent({ x: 0.5, y: 0 })).toBeNull();
    expect(parseMovementIntent({ x: 2, y: 0 })).toBeNull();
    expect(parseMovementIntent({ x: Number.NaN, y: 0 })).toBeNull();
    expect(parseMovementIntent(null)).toBeNull();
  });

  it("normalizes diagonal movement to the same speed as cardinal movement", () => {
    const start = { x: 7, y: 6 };
    const cardinal = stepAuthoritativePosition(start, { x: 1, y: 0 }, 0.05, origin);
    const diagonal = stepAuthoritativePosition(start, { x: 1, y: 1 }, 0.05, origin);
    expect(Math.hypot(cardinal.x - start.x, cardinal.y - start.y)).toBeCloseTo(PLAYER_SPEED * 0.05);
    expect(Math.hypot(diagonal.x - start.x, diagonal.y - start.y)).toBeCloseTo(PLAYER_SPEED * 0.05);
  });

  it("keeps movement within world bounds", () => {
    expect(stepAuthoritativePosition({ x: 13.99, y: 6 }, { x: 1, y: 0 }, 0.1, origin).x).toBe(14);
    expect(stepAuthoritativePosition({ x: 0, y: 6 }, { x: -1, y: 0 }, 0.1, origin).x).toBe(0);
  });

  it("blocks building footprints on the server movement model", () => {
    const blocked = { x: 6.06, y: 5.2 };
    expect(canOccupyNeighborhoodPoint(blocked, origin)).toBe(false);
    expect(canOccupyNeighborhoodPoint({ x: 7, y: 6 }, origin)).toBe(true);
    const moved = stepAuthoritativePosition(blocked, { x: -1, y: 0 }, 0.05, origin);
    expect(moved).toEqual(blocked);
  });
});
