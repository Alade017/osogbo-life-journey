import { describe, expect, it } from "vitest";
import {
  clampTownTarget,
  isTownTap,
  mapTownGridToScene,
  type TownGrid,
} from "@/lib/town-grid";

describe("3D town grid", () => {
  it("maps authored grid cells into centered scene coordinates by cell kind", () => {
    const grid: TownGrid = {
      columns: 4,
      rows: 2,
      cellSize: 2,
      cells: [
        { x: 0, z: 0, kind: "road", seed: 1 },
        { x: 3, z: 1, kind: "building", buildingType: "bank", placeId: "cedar-bank" },
      ],
    };

    expect(mapTownGridToScene(grid)).toEqual([
      { x: -3, y: 0, z: -1, kind: "road", seed: 1 },
      {
        x: 3,
        y: 0,
        z: 1,
        kind: "building",
        buildingType: "bank",
        placeId: "cedar-bank",
      },
    ]);
  });

  it("clamps camera panning inside the town bounds", () => {
    expect(
      clampTownTarget(
        { x: 30, z: -30 },
        { minX: -10, maxX: 10, minZ: -6, maxZ: 6 },
        { x: 2, z: 1 },
      ),
    ).toEqual({ x: 8, z: -5 });
  });

  it("treats short presses as taps and longer movement or time as a drag", () => {
    const start = { x: 100, y: 100, time: 1_000 };
    expect(isTownTap(start, { x: 104, y: 103, time: 1_250 })).toBe(true);
    expect(isTownTap(start, { x: 106, y: 100, time: 1_100 })).toBe(false);
    expect(isTownTap(start, { x: 100, y: 100, time: 1_301 })).toBe(false);
  });
});
