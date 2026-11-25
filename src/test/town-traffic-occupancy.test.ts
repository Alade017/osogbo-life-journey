import { describe, expect, it } from "vitest";
import { trafficClearDistance, TownTrafficOccupancy } from "@/game/town-traffic-occupancy";

describe("ambient traffic occupancy", () => {
  it("stops before a stationary vehicle including the following margin", () => {
    expect(trafficClearDistance([0, 0], [10, 0], 0.5, [{ position: [4, 0], radius: 0.5 }])).toBeCloseTo(2.85);
  });
  it("does not stop for traffic behind or sufficiently far beside the lane", () => {
    expect(trafficClearDistance([0, 0], [10, 0], 0.5, [
      { position: [-1, 0], radius: 0.5 }, { position: [4, 2], radius: 0.5 },
    ])).toBe(10);
  });
  it("permits separation but not deeper overlap", () => {
    const other = [{ position: [0.5, 0] as const, radius: 0.5 }];
    expect(trafficClearDistance([0, 0], [1, 0], 0.5, other)).toBe(0);
    expect(trafficClearDistance([0, 0], [-1, 0], 0.5, other)).toBe(1);
  });
  it("excludes the requesting actor and releases removed vehicles", () => {
    const occupancy = new TownTrafficOccupancy();
    occupancy.set("a", { position: [0, 0], radius: 0.5 });
    occupancy.set("b", { position: [2, 0], radius: 0.5 });
    expect(occupancy.clearance("a", [0, 0], [4, 0], 0.5)).toBeCloseTo(0.85);
    occupancy.remove("b");
    expect(occupancy.clearance("a", [0, 0], [4, 0], 0.5)).toBe(4);
  });
});
