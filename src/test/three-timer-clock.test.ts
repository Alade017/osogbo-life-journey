import { afterEach, expect, it, vi } from "vitest";
import { Clock } from "@/lib/three-timer-clock";

afterEach(() => vi.restoreAllMocks());

it("preserves Fiber's clock start, stop, elapsed writes and delta semantics", () => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const clock = new Clock();
  expect(clock.getDelta()).toBe(0);
  now += 250;
  expect(clock.getDelta()).toBeCloseTo(0.25);
  expect(clock.elapsedTime).toBeCloseTo(0.25);
  clock.stop();
  now += 10000;
  expect(clock.getDelta()).toBe(0);
  clock.start();
  clock.elapsedTime = 10;
  now += 500;
  expect(clock.getElapsedTime()).toBeCloseTo(10.5);
});

it("does not auto-start clocks explicitly created paused", () => {
  const clock = new Clock(false);
  expect(clock.getDelta()).toBe(0);
  expect(clock.running).toBe(false);
});
