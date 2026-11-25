import { describe, expect, it } from "vitest";
import { trafficFrameSeconds, trafficSpeed, trafficBrakingSpeed, trafficHeading, TRAFFIC_MOTION } from "@/game/town-traffic-motion";

describe("ambient traffic dynamics", () => {
  it("bounds suspended frames and rejects invalid time", () => {
    expect(trafficFrameSeconds(60)).toBe(TRAFFIC_MOTION.maxFrameSeconds);
    expect(trafficFrameSeconds(NaN)).toBe(0);
    expect(trafficFrameSeconds(-1)).toBe(0);
  });
  it("accelerates and brakes without overshooting the target", () => {
    expect(trafficSpeed(0, 2, 0.1)).toBeCloseTo(0.18);
    expect(trafficSpeed(1, 0, 0.1)).toBeCloseTo(0.68);
    expect(trafficSpeed(0.1, 0, 0.1)).toBe(0);
    expect(trafficSpeed(0.9, 1, 0.1)).toBe(1);
    expect(trafficBrakingSpeed(0)).toBe(0);
  });
  it("turns along the shortest angle across the wrap boundary", () => {
    expect(trafficHeading(Math.PI - 0.05, -Math.PI + 0.05, 0.1)).toBeCloseTo(Math.PI + 0.05);
    expect(trafficHeading(0, Math.PI / 2, 0.1)).toBeCloseTo(TRAFFIC_MOTION.turnRate * 0.1);
  });
});
