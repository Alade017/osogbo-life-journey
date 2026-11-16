import { describe, it, expect } from "vitest";
import { findTownRoute, sampleTownRoute } from "@/game/town-route";
import town from "@/data/osogbo-town.json";
describe("authored road routing", () => {
  it("follows a connected road detour rather than crossing water or plots", () => {
    const rows = ["rrrrr", "rwwwr", "rgggr", "rrrrr"];
    const route = findTownRoute(rows, [0, 1], [4, 1])!;
    expect(route.cells.length).toBe(7);
    for (let i = 0; i < route.cells.length; i++) {
      const [x, z] = route.cells[i];
      expect(rows[z][x]).toBe("r");
      if (i)
        expect(Math.abs(x - route.cells[i - 1][0]) + Math.abs(z - route.cells[i - 1][1])).toBe(1);
    }
  });
  it("snaps to road access without inventing a line across the building plot", () => {
    const route = findTownRoute(["rrrrr", "ggggg", "ggggg"], [1, 2], [4, 2])!;
    expect(route.start).toEqual([1, 0]);
    expect(route.end).toEqual([4, 0]);
  });
  it("returns unavailable for disconnected roads, invalid coordinates and no roads", () => {
    expect(findTownRoute(["rwr"], [0, 0], [2, 0])).toBeNull();
    expect(findTownRoute(["ggg"], [0, 0], [2, 0])).toBeNull();
    expect(findTownRoute(["rrr"], [NaN, 0], [2, 0])).toBeNull();
  });
  it("samples turns without cutting corners and handles a shared access point", () => {
    expect(
      sampleTownRoute(
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        0.75,
      ),
    ).toEqual([1, 0.5]);
    expect(sampleTownRoute([[1, 1]], 1)).toEqual([1, 1]);
    expect(sampleTownRoute([], 0)).toBeNull();
  });
  it("never leaves authored roads when routing between real map landmarks", () => {
    const start = town.landmarks[0];
    let connected = 0;
    for (const destination of town.landmarks) {
      const route = findTownRoute(
        town.grid.rows,
        [start.grid.x, start.grid.z],
        [destination.grid.x, destination.grid.z],
      );
      if (!route) continue;
      connected++;
      for (const [x, z] of route.cells) expect(town.grid.rows[z][x]).toBe("r");
    }
    expect(connected).toBeGreaterThan(1);
  });
});
