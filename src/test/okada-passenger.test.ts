import { describe, expect, it } from "vitest";
import { bikePoint, boardingPath, mountProgress, MOUNT_SECONDS } from "@/game/okada-passenger";
import { canWalkOnStreet } from "@/game/osun-mall-street-layout";
describe("local motorcycle passenger geometry", () => {
  it("rotates the seat offset with motorcycle heading", () => {
    expect(bikePoint([1,2],0,0,-1)).toEqual([1,1]);
    expect(bikePoint([1,2],Math.PI/2,0,-1)[0]).toBeCloseTo(0);
  });
  it("finds a walkable approach beside a stopped bike", () => {
    const path = boardingPath([0,2],[0,0],0);
    expect(path).not.toBeNull();
    expect(path?.every(canWalkOnStreet)).toBe(true);
  });
  it("clamps the transition and eases both ends", () => {
    expect(mountProgress(-1)).toBe(0);
    expect(mountProgress(MOUNT_SECONDS/2)).toBeCloseTo(0.5);
    expect(mountProgress(10)).toBe(1);
  });
});
