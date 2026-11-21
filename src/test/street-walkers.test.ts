import { describe, expect, it } from "vitest";
import { createWalkers, stepWalker } from "@/game/street-walkers";
import { advanceTrafficCar, type TrafficCar } from "@/game/neighborhood-dressing";

const spots = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 20, y: 0 },
  { x: 300, y: 300 },
];

describe("street walkers", () => {
  it("gives each pedestrian nearby footpath spots to loop through", () => {
    const [first] = createWalkers(spots);
    expect(first?.targets.map((t) => `${t.x},${t.y}`)).toEqual(["10,0", "20,0", "300,300"]);
  });

  it("walks towards the next spot and changes target when it arrives", () => {
    const [first] = createWalkers(spots);
    if (!first) throw new Error("no walker");
    const moved = stepWalker(first, 4);
    expect(moved.x).toBeCloseTo(4);
    expect(moved.y).toBeCloseTo(0);
    const arrived = stepWalker(first, 10);
    expect(arrived.x).toBeCloseTo(10);
    expect(arrived.next).toBe(1);
  });

  it("never walks past its target in a single step", () => {
    const [first] = createWalkers(spots);
    if (!first) throw new Error("no walker");
    const stepped = stepWalker(first, 1000);
    expect(stepped.x).toBeLessThanOrEqual(300);
  });
});

describe("traffic cars", () => {
  const car: TrafficCar = {
    vertical: false,
    across: 40,
    along: 90,
    min: 0,
    max: 100,
    direction: 1,
  };

  it("drives along its lane and re-enters at the start when it reaches the end", () => {
    expect(advanceTrafficCar(car, 5).along).toBeCloseTo(95);
    expect(advanceTrafficCar(car, 15).along).toBeCloseTo(5);
  });

  it("reverses the wrap for a car driving towards smaller coordinates", () => {
    const back = { ...car, direction: -1 as const, along: 4 };
    expect(advanceTrafficCar(back, 10).along).toBeCloseTo(94);
  });
});
